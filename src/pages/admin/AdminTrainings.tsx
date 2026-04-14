import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminTrainings } from '@/hooks/admin/useAdminTrainings';
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
import { Plus, Pencil, Trash2, Users, BookOpen, AlertTriangle, ArrowLeft, ArrowRight, ImagePlus, X, Eye, Percent, Wrench, Trophy, Clock, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { TrainingSessionCurriculum } from '@/lib/trainingSessionCurriculum';
import { parseTrainingSessions } from '@/lib/trainingSessionCurriculum';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  TRAINING_PLATFORM_MARKUP_MAX,
  TRAINING_PLATFORM_VAT_MAX,
  clampTrainingPlatformMarkupPercent,
  clampTrainingVatPercent,
} from '@/lib/trainingPlatformMarkup';
import { useTrainingPlatformPricing } from '@/hooks/useTrainingPlatformPricing';
import type { Json } from '@/integrations/supabase/types';

const TRAINING_MARKUP_SETTING_KEY = 'training_platform_markup_percent';
const TRAINING_VAT_SETTING_KEY = 'training_platform_vat_percent';


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
  default_sessions_count?: number;
  default_session_duration_hours?: number;
  trainer_supplies?: unknown;
  sessions?: unknown;
}

type TrainerSupply = { name_ar: string; name_en: string };

function trainingsJsonify(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

/** PostgREST when a column is missing or schema cache is stale */
function isMissingTrainingsColumnError(err: unknown, column: string): boolean {
  const msg =
    err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : '';
  if (!msg) return false;
  return msg.includes(`'${column}'`) || (msg.includes('schema cache') && msg.includes(column));
}

function parseTrainerSupplies(raw: unknown): TrainerSupply[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        name_ar: String(o.name_ar ?? '').trim(),
        name_en: String(o.name_en ?? '').trim(),
      };
    })
    .filter((x) => x.name_ar && x.name_en);
}

const AdminTrainings: React.FC = () => {
  const { useRQ, useRM, queryClient, dbFrom } = useAdminTrainings();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const fieldDir = isRTL ? 'rtl' : 'ltr';
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name_ar: '',
    name_en: '',
    type: 'practical' as 'theory' | 'practical',
    description_ar: '',
    description_en: '',
    level: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    status: 'active' as 'active' | 'archived',
    default_sessions_count: 1,
    default_session_duration_hours: 2,
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'practical' | 'theory'>('all');
  const [supplies, setSupplies] = useState<TrainerSupply[]>([]);
  const [newSupply, setNewSupply] = useState({ name_ar: '', name_en: '' });
  const [sessions, setSessions] = useState<TrainingSessionCurriculum[]>([]);
  const [openSessionIndex, setOpenSessionIndex] = useState<number | null>(null);

  const { data: trainings, isLoading } = useRQ({
    queryKey: ['admin-trainings'],
    queryFn: async () => {
      const { data, error } = await dbFrom('trainings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Training[];
    },
  });

  const filteredTrainings = useMemo(() => {
    if (!trainings) return [];
    if (typeFilter === 'all') return trainings;
    return trainings.filter((t) => t.type === typeFilter);
  }, [trainings, typeFilter]);

  const { data: trainerCounts } = useRQ({
    queryKey: ['training-trainer-counts'],
    queryFn: async () => {
      const { data, error } = await dbFrom('trainer_courses').select('training_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(tc => { counts[tc.training_id] = (counts[tc.training_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: pricing, isLoading: pricingLoading } = useTrainingPlatformPricing();
  const [markupDraft, setMarkupDraft] = useState('0');
  const [vatDraft, setVatDraft] = useState('0');
  useEffect(() => {
    if (pricing) {
      setMarkupDraft(String(pricing.markupPercent));
      setVatDraft(String(pricing.vatPercent));
    }
  }, [pricing]);

  const savePricingMutation = useRM({
    mutationFn: async () => {
      const markupPct = clampTrainingPlatformMarkupPercent(parseFloat(String(markupDraft).replace(',', '.')));
      const vatPct = clampTrainingVatPercent(parseFloat(String(vatDraft).replace(',', '.')));
      const ts = new Date().toISOString();
      const uid = user?.id ?? null;
      const { error } = await dbFrom('admin_settings').upsert(
        [
          {
            key: TRAINING_MARKUP_SETTING_KEY,
            category: 'training',
            value: { percent: markupPct },
            updated_by: uid,
            updated_at: ts,
          },
          {
            key: TRAINING_VAT_SETTING_KEY,
            category: 'training',
            value: { percent: vatPct },
            updated_by: uid,
            updated_at: ts,
          },
        ],
        { onConflict: 'key' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['admin-setting', TRAINING_MARKUP_SETTING_KEY] });
      toast.success(isRTL ? 'تم حفظ إعدادات التسعير والضريبة' : 'Pricing & VAT settings saved');
    },
    onError: () => toast.error(isRTL ? 'تعذر الحفظ' : 'Save failed'),
  });

  const saveMutation = useRM({
    mutationFn: async (data: typeof form & { id?: string; background_image?: string | null; trainer_supplies?: TrainerSupply[]; sessions?: TrainingSessionCurriculum[] }) => {
      const { id, ...rest } = data;
      const payload: Record<string, unknown> = {
        name_ar: rest.name_ar,
        name_en: rest.name_en,
        type: rest.type,
        description_ar: rest.description_ar,
        description_en: rest.description_en,
        level: rest.level,
        status: rest.status,
        default_sessions_count: rest.default_sessions_count,
        default_session_duration_hours: rest.default_session_duration_hours,
        background_image: rest.background_image ?? null,
        trainer_supplies: trainingsJsonify(rest.trainer_supplies ?? []),
        sessions: trainingsJsonify(rest.sessions ?? []),
      };

      const upsert = async (body: Record<string, unknown>) => {
        if (id) {
          return dbFrom('trainings').update(body).eq('id', id);
        }
        return dbFrom('trainings').insert(body);
      };

      const body: Record<string, unknown> = { ...payload };
      let { error } = await upsert(body);

      if (error && isMissingTrainingsColumnError(error, 'sessions')) {
        toast.warning(
          isRTL
            ? 'تم الحفظ بدون منهج الجلسات — طبّق migration لعمود sessions على قاعدة البيانات، أو أعد تحميل مخطط PostgREST.'
            : 'Saved without session curriculum — apply the trainings.sessions migration (or reload PostgREST schema cache).',
        );
        delete body.sessions;
        ({ error } = await upsert(body));
      }

      if (error && isMissingTrainingsColumnError(error, 'trainer_supplies')) {
        toast.warning(
          isRTL
            ? 'تم الحفظ بدون قائمة مستلزمات المدرب — طبّق migration لعمود trainer_supplies.'
            : 'Saved without trainer supplies — apply the trainer_supplies migration.',
        );
        delete body.trainer_supplies;
        ({ error } = await upsert(body));
      }

      if (error) {
        const msg = error.message || String(error);
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['all-trainings-catalog'] });
      setFormOpen(false);
      setUploadingImage(false);
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully');
    },
    onError: (err: unknown) => {
      setUploadingImage(false);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(isRTL ? `تعذر الحفظ: ${msg}` : msg);
    },
  });

  const deleteMutation = useRM({
    mutationFn: async (id: string) => {
      const { error } = await dbFrom('trainings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['all-trainings-catalog'] });
      setDeleteId(null);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted successfully');
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  });

  const openAdd = () => {
    setEditingTraining(null);
    setForm({
      name_ar: '',
      name_en: '',
      type: 'practical',
      description_ar: '',
      description_en: '',
      level: 'beginner',
      status: 'active',
      default_sessions_count: 1,
      default_session_duration_hours: 2,
    });
    setSupplies([]);
    setSessions([]);
    setOpenSessionIndex(null);
    setNewSupply({ name_ar: '', name_en: '' });
    setImageFile(null);
    setImagePreview(null);
    setFormOpen(true);
  };

  const openEdit = (t: Training) => {
    setEditingTraining(t);
    setForm({
      name_ar: t.name_ar,
      name_en: t.name_en,
      type: t.type as typeof form.type,
      description_ar: t.description_ar,
      description_en: t.description_en,
      level: t.level as typeof form.level,
      status: t.status as typeof form.status,
      default_sessions_count: Math.max(1, Number(t.default_sessions_count ?? 1)),
      default_session_duration_hours: Math.max(0.25, Number(t.default_session_duration_hours ?? 2)),
    });
    setSupplies(parseTrainerSupplies(t.trainer_supplies));
    setSessions(parseTrainingSessions(t.sessions));
    setOpenSessionIndex(null);
    setNewSupply({ name_ar: '', name_en: '' });
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
      saveMutation.mutate({
        ...form,
        background_image: bgUrl,
        id: editingTraining?.id,
        trainer_supplies: supplies,
        sessions,
      } as typeof form & { id?: string; background_image?: string | null; trainer_supplies: TrainerSupply[]; sessions: TrainingSessionCurriculum[] });
    } catch {
      toast.error(isRTL ? 'فشل رفع الصورة' : 'Image upload failed');
      setUploadingImage(false);
    }
  };

  const addSupply = () => {
    const name_ar = newSupply.name_ar.trim();
    const name_en = newSupply.name_en.trim();
    if (!name_ar || !name_en) {
      toast.error(isRTL ? 'أدخل الاسم بالعربية والإنجليزية' : 'Enter Arabic and English names');
      return;
    }
    const dup = supplies.some(
      (s) => s.name_ar.toLowerCase() === name_ar.toLowerCase() || s.name_en.toLowerCase() === name_en.toLowerCase(),
    );
    if (dup) {
      toast.error(isRTL ? 'هذا العنصر مضاف مسبقاً' : 'This supply is already added');
      return;
    }
    setSupplies((prev) => [...prev, { name_ar, name_en }]);
    setNewSupply({ name_ar: '', name_en: '' });
  };

  const addSession = () => {
    setSessions((prev) => {
      const nextIndex = prev.length;
      setOpenSessionIndex(nextIndex);
      return [
        ...prev,
        {
          session_number: prev.length + 1,
          title_ar: '',
          title_en: '',
          duration_hours: 1,
          points: 10,
          objectives: [],
        },
      ];
    });
  };

  const removeSession = (index: number) => {
    setSessions((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, session_number: i + 1 })),
    );
    setOpenSessionIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const updateSession = (index: number, field: keyof TrainingSessionCurriculum, value: string | number) => {
    setSessions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const addObjective = (sessionIndex: number) => {
    setSessions((prev) =>
      prev.map((s, i) =>
        i === sessionIndex ? { ...s, objectives: [...s.objectives, { ar: '', en: '' }] } : s,
      ),
    );
  };

  const removeObjective = (sessionIndex: number, objIndex: number) => {
    setSessions((prev) =>
      prev.map((s, i) =>
        i === sessionIndex ? { ...s, objectives: s.objectives.filter((_, oi) => oi !== objIndex) } : s,
      ),
    );
  };

  const updateObjective = (sessionIndex: number, objIndex: number, lang: 'ar' | 'en', value: string) => {
    setSessions((prev) =>
      prev.map((s, i) =>
        i === sessionIndex
          ? {
              ...s,
              objectives: s.objectives.map((obj, oi) =>
                oi === objIndex ? { ...obj, [lang]: value } : obj,
              ),
            }
          : s,
      ),
    );
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
        <div className="flex flex-col gap-6 max-w-4xl mx-auto" dir={fieldDir}>
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
          <Card className="order-1">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'المعلومات الأساسية' : 'Basic Information'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" dir="ltr">
                <div className="space-y-2 order-1 sm:order-2">
                  <Label dir="rtl">اسم التدريب</Label>
                  <Input
                    value={form.name_ar}
                    onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                    placeholder="اسم التدريب"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2 order-2 sm:order-1">
                  <Label dir="ltr">Training Name</Label>
                  <Input
                    value={form.name_en}
                    onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                    placeholder="Training name"
                    dir="ltr"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section: Sessions curriculum */}
          <Card className="order-4">
            <CardContent className="p-6 space-y-5" dir={fieldDir}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-start">
                  {isRTL ? 'الجلسات' : 'Sessions'}
                </h3>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0 self-end sm:self-auto" onClick={addSession}>
                  <Plus className="h-4 w-4" />
                  {isRTL ? 'إضافة جلسة' : 'Add session'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? 'أضف الجلسات بالترتيب. كل جلسة تحتوي على عنوان، مدة، نقاط، وأهداف تعليمية واضحة.'
                  : 'Add sessions in order. Each session includes title, duration, points, and clear learning objectives.'}
              </p>

              <div className="space-y-3">
                {sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    <p>{isRTL ? 'لا توجد جلسات بعد.' : 'No sessions added yet.'}</p>
                    <Button type="button" variant="secondary" size="sm" className="mt-3 gap-1.5" onClick={addSession}>
                      <Plus className="h-4 w-4" />
                      {isRTL ? 'ابدأ بإضافة أول جلسة' : 'Add your first session'}
                    </Button>
                  </div>
                ) : null}
                {sessions.map((session, i) => (
                  <Collapsible
                    key={i}
                    open={openSessionIndex === i}
                    onOpenChange={(next) => setOpenSessionIndex(next ? i : null)}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 sm:px-4">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="group flex flex-1 min-w-0 items-center gap-2 text-start py-1"
                        >
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openSessionIndex === i ? 'rotate-180' : ''}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-semibold text-primary">
                                {isRTL ? `الجلسة ${session.session_number}` : `Session ${session.session_number}`}
                              </span>
                              {(isRTL ? session.title_ar : session.title_en) ? (
                                <>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="truncate max-w-[200px] text-foreground">
                                    {isRTL ? session.title_ar : session.title_en}
                                  </span>
                                </>
                              ) : null}
                              <span className="text-muted-foreground">·</span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" />
                                {session.duration_hours} {isRTL ? 'ساعة' : 'hrs'}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span className="flex items-center gap-1 text-amber-500">
                                <Trophy className="w-3.5 h-3.5" />
                                {session.points} {isRTL ? 'نقطة' : 'pts'}
                              </span>
                              {session.objectives.length > 0 ? (
                                <>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground text-xs">
                                    {session.objectives.length} {isRTL ? 'أهداف' : 'objectives'}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => removeSession(i)}
                        aria-label={isRTL ? 'حذف الجلسة' : 'Remove session'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <CollapsibleContent>
                      <div className="space-y-4 p-4 sm:p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" dir="ltr">
                          <div className="space-y-2 order-1 sm:order-2 rounded-lg border border-border/60 p-3">
                            <Label dir="rtl">عنوان الجلسة</Label>
                            <Input
                              value={session.title_ar}
                              onChange={(e) => updateSession(i, 'title_ar', e.target.value)}
                              placeholder="مثال: مقدمة في قيادة الدراجة"
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-2 order-2 sm:order-1 rounded-lg border border-border/60 p-3">
                            <Label dir="ltr">Session Title</Label>
                            <Input
                              value={session.title_en}
                              onChange={(e) => updateSession(i, 'title_en', e.target.value)}
                              placeholder="e.g. Introduction to Motorcycle Riding"
                              dir="ltr"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="space-y-0.5 min-h-[36px]">
                              <Label>{isRTL ? 'عدد الساعات' : 'Duration (hours)'}</Label>
                              <p className="text-[10px] text-muted-foreground">
                                {isRTL ? '\u00a0' : '\u00a0'}
                              </p>
                            </div>
                            <Input
                              type="number"
                              min={0.5}
                              step={0.5}
                              dir="ltr"
                              value={session.duration_hours}
                              onChange={(e) =>
                                updateSession(i, 'duration_hours', parseFloat(e.target.value) || 0)
                              }
                              placeholder="2"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="space-y-0.5 min-h-[36px]">
                              <Label>{isRTL ? 'النقاط' : 'Points'}</Label>
                              <p className="text-[10px] text-muted-foreground font-normal">
                                {isRTL ? '(تُمنح عند إتمام الجلسة)' : '(awarded on completion)'}
                              </p>
                            </div>
                            <Input
                              type="number"
                              min={0}
                              dir="ltr"
                              value={session.points}
                              onChange={(e) =>
                                updateSession(i, 'points', parseInt(e.target.value, 10) || 0)
                              }
                              placeholder="10"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 rounded-lg border border-border/60 p-3">
                          <Label>{isRTL ? 'ماذا ستتعلم في هذه الجلسة' : "What You'll Learn"}</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center text-xs text-muted-foreground" dir="ltr">
                            <span className="order-2 sm:order-1" dir="ltr">{isRTL ? 'Objective (EN)' : 'Objective (EN)'}</span>
                            <span className="order-1 sm:order-2 text-right" dir="rtl">{isRTL ? 'الهدف (AR)' : 'Objective (AR)'}</span>
                            <span className="order-3">&nbsp;</span>
                          </div>
                          {session.objectives.map((obj, oi) => (
                            <div
                              key={oi}
                              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center"
                              dir="ltr"
                            >
                              <Input
                                value={obj.en}
                                onChange={(e) => updateObjective(i, oi, 'en', e.target.value)}
                                placeholder="e.g. Learn correct sitting posture"
                                dir="ltr"
                                className="order-2 sm:order-1"
                              />
                              <Input
                                value={obj.ar}
                                onChange={(e) => updateObjective(i, oi, 'ar', e.target.value)}
                                placeholder="مثال: تعلم وضعية الجلوس الصحيحة"
                                dir="rtl"
                                className="order-1 sm:order-2"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 h-9 w-9 sm:h-8 sm:w-8 justify-self-start order-3"
                                onClick={() => removeObjective(i, oi)}
                                aria-label={isRTL ? 'حذف الهدف' : 'Remove objective'}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                          {session.objectives.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {isRTL ? 'لا توجد أهداف تعليمية بعد. أضف هدفاً واحداً على الأقل.' : 'No objectives yet. Add at least one learning objective.'}
                            </p>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            onClick={() => addObjective(i)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isRTL ? 'إضافة هدف تعليمي' : 'Add Learning Objective'}
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>

              {sessions.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 px-4 py-3 rounded-xl bg-muted/30 text-sm">
                  <span className="text-muted-foreground">
                    {isRTL ? `${sessions.length} جلسات` : `${sessions.length} sessions`}
                  </span>
                  <span className="text-muted-foreground hidden sm:inline">·</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {sessions.reduce((t, s) => t + s.duration_hours, 0)} {isRTL ? 'ساعة' : 'hrs'}
                  </span>
                  <span className="text-muted-foreground hidden sm:inline">·</span>
                  <span className="flex items-center gap-1 text-amber-500 font-semibold">
                    <Trophy className="w-3.5 h-3.5" />
                    {sessions.reduce((t, s) => t + s.points, 0)} {isRTL ? 'نقطة' : 'pts'}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Section: Description */}
          <Card className="order-2">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الوصف' : 'Description'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" dir="ltr">
                <div className="space-y-2 order-1 sm:order-2">
                  <Label dir="rtl">الوصف</Label>
                  <Textarea
                    value={form.description_ar}
                    onChange={(e) => setForm((f) => ({ ...f, description_ar: e.target.value }))}
                    placeholder="وصف التدريب"
                    dir="rtl"
                    rows={3}
                  />
                </div>
                <div className="space-y-2 order-2 sm:order-1">
                  <Label dir="ltr">Description</Label>
                  <Textarea
                    value={form.description_en}
                    onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))}
                    placeholder="Training description"
                    dir="ltr"
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="order-5">
            <CardContent className="p-6 space-y-4" dir={fieldDir}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {isRTL ? 'ما يوفره المدرب' : 'Trainer Supplies'}
              </h3>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" dir="ltr">
                <div className="space-y-1 order-2 sm:order-1">
                  <Label dir="ltr">Name (EN)</Label>
                  <Input
                    dir="ltr"
                    placeholder="e.g. Hand Guards"
                    value={newSupply.name_en}
                    onChange={(e) => setNewSupply((p) => ({ ...p, name_en: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 order-1 sm:order-2">
                  <Label dir="rtl">الاسم (عربي)</Label>
                  <Input
                    dir="rtl"
                    placeholder="مثال: حامي اليدين"
                    value={newSupply.name_ar}
                    onChange={(e) => setNewSupply((p) => ({ ...p, name_ar: e.target.value }))}
                  />
                </div>
                <Button type="button" onClick={addSupply} className="gap-1 order-3">
                  <Plus className="h-4 w-4" />
                  {isRTL ? 'إضافة' : 'Add'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {supplies.map((item, idx) => (
                  <Badge key={`${item.name_en}-${idx}`} variant="secondary" className="gap-1 px-3 py-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    {item.name_ar} / {item.name_en}
                    <button
                      type="button"
                      className="ms-1 inline-flex"
                      onClick={() => setSupplies((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={isRTL ? 'حذف' : 'Remove'}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section: Background Image */}
          <Card className="order-6">
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
          <Card className="order-3">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-start">{isRTL ? 'التصنيف' : 'Classification'}</h3>
              <div dir={fieldDir} className="grid gap-4 md:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label className="block text-start">{isRTL ? 'النوع' : 'Type'}</Label>
                  <Select
                    dir={fieldDir}
                    value={form.type}
                    onValueChange={(v) => setForm((f) => ({ ...f, type: v as typeof f.type }))}
                  >
                    <SelectTrigger dir={fieldDir}>
                      <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} />
                    </SelectTrigger>
                    <SelectContent dir={fieldDir}>
                      <SelectItem value="theory">{isRTL ? 'نظري' : 'Theory'}</SelectItem>
                      <SelectItem value="practical">{isRTL ? 'عملي' : 'Practical'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label className="block text-start">{isRTL ? 'المستوى' : 'Level'}</Label>
                  <Select
                    dir={fieldDir}
                    value={form.level}
                    onValueChange={(v) => setForm((f) => ({ ...f, level: v as typeof f.level }))}
                  >
                    <SelectTrigger dir={fieldDir}>
                      <SelectValue placeholder={isRTL ? 'اختر المستوى' : 'Select level'} />
                    </SelectTrigger>
                    <SelectContent dir={fieldDir}>
                      <SelectItem value="beginner">{isRTL ? 'مبتدئ' : 'Beginner'}</SelectItem>
                      <SelectItem value="intermediate">{isRTL ? 'متوسط' : 'Intermediate'}</SelectItem>
                      <SelectItem value="advanced">{isRTL ? 'متقدم' : 'Advanced'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div className="min-w-0 text-start">
                  <Label className="text-sm font-medium">{isRTL ? 'الحالة' : 'Status'}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'تفعيل أو تعطيل هذا التدريب' : 'Enable or disable this training'}</p>
                </div>
                <Switch checked={form.status === 'active'} onCheckedChange={v => setForm(f => ({...f, status: v ? 'active' : 'archived'}))} />
              </div>
            </CardContent>
          </Card>

          {/* Bottom Save */}
          <div className="order-7 flex justify-end gap-3 pb-6">
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'إدارة التدريبات' : 'Trainings Management'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-[200px]" dir={fieldDir}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir={fieldDir}>
                <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                <SelectItem value="practical">{isRTL ? 'عملي فقط' : 'Practical only'}</SelectItem>
                <SelectItem value="theory">{isRTL ? 'نظري فقط' : 'Theory only'}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openAdd} size="sm">
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? 'إضافة تدريب' : 'Add Training'}
            </Button>
          </div>
        </div>

        <Card className="border-primary/25 bg-primary/[0.03]">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-primary">
                  <Percent className="h-5 w-5 shrink-0" />
                  <h2 className="text-lg font-semibold text-foreground">
                    {isRTL ? 'تسعير حجوزات التدريب العملي مع المدرب' : 'Practical training booking pricing'}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isRTL
                    ? 'أدخل نسب العمولة والضريبة لتطبيقها تلقائياً على أسعار حجوزات التدريب العملي.'
                    : 'Set commission and VAT percentages to apply automatically to practical booking prices.'}
                </p>
                <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                  {isRTL
                    ? `مثال تقريبي: أساس 100 ر.س + عمولة ${markupDraft || '0'}% ثم ضريبة ${vatDraft || '15'}% على المجموع — يُقرب للريال الصحيح عند الدفع.`
                    : `Example: 100 SAR base + ${markupDraft || '0'}% commission, then ${vatDraft || '15'}% VAT on that subtotal — rounded up to the nearest halala at checkout.`}
                </p>
              </div>
              <div className="flex flex-col gap-3 shrink-0 w-full max-w-md" dir="ltr">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-start block">
                      {isRTL ? 'عمولة بايكرز (%)' : 'Bikerz commission (%)'}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={TRAINING_PLATFORM_MARKUP_MAX}
                      step={0.1}
                      value={markupDraft}
                      onChange={(e) => setMarkupDraft(e.target.value)}
                      className="h-10"
                      disabled={savePricingMutation.isPending || pricingLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-start block">
                      {isRTL ? 'ضريبة القيمة المضافة السعودية (%)' : 'Saudi VAT (%)'}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={TRAINING_PLATFORM_VAT_MAX}
                      step={0.1}
                      value={vatDraft}
                      onChange={(e) => setVatDraft(e.target.value)}
                      className="h-10"
                      disabled={savePricingMutation.isPending || pricingLoading}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => savePricingMutation.mutate()}
                  disabled={savePricingMutation.isPending || pricingLoading}
                  className="h-10 w-full sm:w-auto"
                >
                  {savePricingMutation.isPending ? '…' : isRTL ? 'حفظ التسعير والضريبة' : 'Save pricing & VAT'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
            ) : (trainings?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{isRTL ? 'لا توجد تدريبات بعد' : 'No trainings yet'}</h3>
                <p className="text-sm text-muted-foreground mb-4">{isRTL ? 'ابدأ بإضافة أول تدريب' : 'Get started by adding your first training'}</p>
                <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 me-2" />{isRTL ? 'إضافة تدريب' : 'Add Training'}</Button>
              </div>
            ) : filteredTrainings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-4">
                <p className="text-sm text-muted-foreground mb-3">
                  {isRTL ? 'لا توجد برامج ضمن التصفية الحالية.' : 'No programs match the current filter.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => setTypeFilter('all')}>
                  {isRTL ? 'عرض الكل' : 'Show all'}
                </Button>
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
                  {filteredTrainings.map(t => (
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

      
    </AdminLayout>
  );
};

export default AdminTrainings;
