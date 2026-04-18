import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Rocket, Target, Zap, Shield, Trophy, Award, Crown, Star,
  Medal, Flame, Plus, Pencil, Trash2, Loader2, AlertTriangle,
  ChevronUp, ChevronDown, GraduationCap, ArrowLeft, ArrowRight, Save, X,
  Users, Search, Eye, CheckCircle2, XCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ReqLabels, CustomRequirement } from '@/hooks/useUserProfile';
import { COUNTRIES } from '@/data/countryCityData';

/** Resolve a country code (e.g. "PS") or full name to its localised name. */
function resolveCountry(value: string | null, isRTL: boolean): string {
  if (!value) return '';
  const entry = COUNTRIES.find(
    (c) => c.code === value || c.en === value || c.ar === value,
  );
  if (entry) return isRTL ? entry.ar : entry.en;
  return value;
}

/** Resolve a city English name to its localised name using all countries' city lists. */
function resolveCity(value: string | null, isRTL: boolean): string {
  if (!value) return '';
  if (!isRTL) return value;
  for (const country of COUNTRIES) {
    const city = country.cities.find(
      (c) => c.en === value || c.ar === value,
    );
    if (city) return city.ar;
  }
  return value;
}

// ============================================================
// Types
// ============================================================
interface RankDefinition {
  id: string;
  name: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  promotion_trigger_en: string;
  promotion_trigger_ar: string;
  icon: string;
  color: string;
  bg_color: string;
  border_color: string;
  sort_order: number;
  is_admin_only: boolean;
  req_first_course: boolean;
  req_has_license: boolean;
  req_motorcycle_vin: boolean;
  req_km_logged: number | null;
  req_core_training: boolean;
  req_courses_sold_min: number | null;
  req_courses_sold_max: number | null;
  req_programs_sold_min: number | null;
  req_labels: ReqLabels;
  custom_requirements: CustomRequirement[];
  created_at: string;
  updated_at: string;
}

type RankTbl = 'rank_definitions';

interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  experience_level: string | null;
  rank_override: boolean;
  has_license: boolean;
  license_verified: boolean;
  motorcycle_vin: string | null;
  vin_verified: boolean;
  km_logged: number;
  courses_sold_count: number;
  created_at: string;
}

interface RequirementCheck {
  label_en: string;
  label_ar: string;
  met: boolean;
  isAdminOnly?: boolean;
}

// ============================================================
// Icon + Color catalogs
// ============================================================
const ICON_MAP: Record<string, React.ElementType> = {
  Rocket, Target, Zap, Shield, Trophy, Award, Crown, Star, Medal, Flame,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  { label: 'Slate',   color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/30',   dot: 'bg-slate-400'   },
  { label: 'Blue',    color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    dot: 'bg-blue-400'    },
  { label: 'Green',   color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/30',   dot: 'bg-green-400'   },
  { label: 'Emerald', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  { label: 'Yellow',  color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  dot: 'bg-yellow-400'  },
  { label: 'Orange',  color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  dot: 'bg-orange-400'  },
  { label: 'Purple',  color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  dot: 'bg-purple-400'  },
  { label: 'Primary', color: 'text-primary',     bg: 'bg-primary/10',     border: 'border-primary/30',     dot: 'bg-primary'     },
];

function RankIcon({ iconName, className }: { iconName: string; className?: string }) {
  const Comp = ICON_MAP[iconName] ?? Star;
  return <Comp className={className} />;
}

// ============================================================
// Empty form helper
// ============================================================
const emptyForm = (): Omit<RankDefinition, 'id' | 'created_at' | 'updated_at'> => ({
  name: '',
  name_ar: '',
  description_en: '',
  description_ar: '',
  promotion_trigger_en: '',
  promotion_trigger_ar: '',
  icon: 'Star',
  color: 'text-primary',
  bg_color: 'bg-primary/10',
  border_color: 'border-primary/30',
  sort_order: 0,
  is_admin_only: false,
  req_first_course: false,
  req_has_license: false,
  req_motorcycle_vin: false,
  req_km_logged: null,
  req_core_training: false,
  req_courses_sold_min: null,
  req_courses_sold_max: null,
  req_programs_sold_min: null,
  req_labels: {},
  custom_requirements: [],
});

// ============================================================
// Requirement chips helper
// ============================================================
function ReqChips({ rank, isRTL }: { rank: RankDefinition; isRTL: boolean }) {
  const chips: React.ReactNode[] = [];
  if (rank.req_first_course)   chips.push(<Badge key="fc"   variant="secondary" className="text-[9px]">{isRTL ? 'أول كورس' : '1st Course'}</Badge>);
  if (rank.req_has_license)    chips.push(<Badge key="lic"  variant="secondary" className="text-[9px]">{isRTL ? 'رخصة' : 'License'}</Badge>);
  if (rank.req_motorcycle_vin) chips.push(<Badge key="vin"  variant="secondary" className="text-[9px]">VIN</Badge>);
  if (rank.req_core_training)  chips.push(<Badge key="trn"  variant="secondary" className="text-[9px]">{isRTL ? 'تدريب' : 'Training'}</Badge>);
  if (rank.req_km_logged)      chips.push(<Badge key="km"   variant="secondary" className="text-[9px]" dir="ltr">{rank.req_km_logged} km</Badge>);
  if (rank.req_courses_sold_min) chips.push(
    <Badge key="cs" variant="secondary" className="text-[9px]" dir="ltr">
      {rank.req_courses_sold_min}{rank.req_courses_sold_max ? `–${rank.req_courses_sold_max}` : '+'} {isRTL ? 'كورس' : 'course'}
    </Badge>,
  );
  if (rank.req_programs_sold_min) chips.push(
    <Badge key="ps" variant="secondary" className="text-[9px]" dir="ltr">
      {rank.req_programs_sold_min}+ {isRTL ? 'برنامج' : 'program'}
    </Badge>,
  );
  if (rank.is_admin_only) chips.push(<Badge key="adm" variant="destructive" className="text-[9px]">{isRTL ? 'أدمن فقط' : 'Admin only'}</Badge>);
  if (chips.length === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  return <div className="flex flex-wrap gap-1">{chips}</div>;
}

// ============================================================
// Page
// ============================================================
const AdminRanks: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  // 'list' | 'form' | 'students'
  const [view, setView] = useState<'list' | 'form' | 'students'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<RankDefinition | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<number | null>(null);

  // Students child page state
  const [studentsRank, setStudentsRank] = useState<RankDefinition | null>(null);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [selectedRankForPromotion, setSelectedRankForPromotion] = useState('');
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [promotionChecks, setPromotionChecks] = useState<RequirementCheck[]>([]);

  // ── fetch helper (bypasses generated types for new table) ──────────
  const db = (table: RankTbl) =>
    (supabase as unknown as {
      from: (t: RankTbl) => Record<string, unknown>;
    }).from(table);

  // ── Queries ─────────────────────────────────────────────────────────
  const { data: ranks = [], isLoading } = useQuery<RankDefinition[]>({
    queryKey: ['admin-rank-definitions'],
    queryFn: async () => {
      const { data, error } = await (db('rank_definitions') as unknown as {
        select: (c: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
        };
      }).select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as RankDefinition[]) ?? [];
    },
  });

  // Fetch all profiles' experience_level to count per rank
  const { data: allLevels = [] } = useQuery<{ experience_level: string | null }[]>({
    queryKey: ['rank-usage-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('experience_level');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const rankUsageCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allLevels) {
      if (p.experience_level) map.set(p.experience_level, (map.get(p.experience_level) ?? 0) + 1);
    }
    return map;
  }, [allLevels]);

  // Fetch students in the currently-viewed rank
  const { data: rankStudents = [], isLoading: studentsLoading } = useQuery<StudentProfile[]>({
    queryKey: ['rank-students', studentsRank?.name],
    enabled: view === 'students' && !!studentsRank,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('experience_level', studentsRank!.name)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as StudentProfile[]) ?? [];
    },
  });

  const filteredStudents = useMemo(() => {
    if (!studentsSearch.trim()) return rankStudents;
    const q = studentsSearch.toLowerCase();
    return rankStudents.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q),
    );
  }, [rankStudents, studentsSearch]);

  // Promote student mutation
  const promoteStudentMutation = useMutation({
    mutationFn: async ({ userId, newRank }: { userId: string; newRank: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ experience_level: newRank, rank_override: true })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم تغيير الرتبة بنجاح' : 'Rank updated successfully');
      queryClient.invalidateQueries({ queryKey: ['rank-students'] });
      queryClient.invalidateQueries({ queryKey: ['rank-usage-counts'] });
      setShowPromoteConfirm(false);
      setSelectedStudent(null);
      setSelectedRankForPromotion('');
    },
    onError: () => toast.error(isRTL ? 'فشل تغيير الرتبة' : 'Failed to update rank'),
  });

  // Build requirement checks for promotion confirmation
  function buildPromotionChecks(targetRankName: string, student: StudentProfile): RequirementCheck[] {
    const rankDef = ranks.find((r) => r.name === targetRankName);
    if (!rankDef) return [];
    const checks: RequirementCheck[] = [];
    if (rankDef.req_first_course)    checks.push({ label_en: 'Purchased first course',         label_ar: 'شراء أول كورس',               met: false });
    if (rankDef.req_has_license)     checks.push({ label_en: 'Verified motorcycle license',     label_ar: 'رخصة دراجة موثقة',            met: !!student.has_license && !!student.license_verified });
    if (rankDef.req_motorcycle_vin)  checks.push({ label_en: 'Verified motorcycle VIN',         label_ar: 'رقم هيكل الدراجة (VIN) موثق', met: !!student.motorcycle_vin && !!student.vin_verified });
    if (rankDef.req_km_logged)       checks.push({ label_en: `${rankDef.req_km_logged} km logged (current: ${student.km_logged})`, label_ar: `${rankDef.req_km_logged} كم مسجلة (الحالي: ${student.km_logged})`, met: student.km_logged >= rankDef.req_km_logged });
    if (rankDef.req_core_training)   checks.push({ label_en: 'Complete core training',          label_ar: 'إتمام التدريب الأساسي',        met: false });
    if (rankDef.req_courses_sold_min) checks.push({ label_en: `Sold ${rankDef.req_courses_sold_min}+ courses (current: ${student.courses_sold_count})`, label_ar: `بيع ${rankDef.req_courses_sold_min}+ كورسات (الحالي: ${student.courses_sold_count})`, met: student.courses_sold_count >= rankDef.req_courses_sold_min });
    if (rankDef.req_programs_sold_min) checks.push({ label_en: `Sold ${rankDef.req_programs_sold_min}+ programs (current: ${student.courses_sold_count})`, label_ar: `بيع ${rankDef.req_programs_sold_min}+ برامج (الحالي: ${student.courses_sold_count})`, met: student.courses_sold_count >= rankDef.req_programs_sold_min });
    if (rankDef.is_admin_only) checks.push({ label_en: 'Admin approval (always required)', label_ar: 'موافقة الأدمن (مطلوبة دائماً)', met: true, isAdminOnly: true });
    return checks;
  }

  const openPromote = (student: StudentProfile, rankName: string) => {
    setSelectedRankForPromotion(rankName);
    setPromotionChecks(buildPromotionChecks(rankName, student));
    setShowPromoteConfirm(true);
  };

  // ── Mutations ────────────────────────────────────────────────────────
  const upsertMutation = useMutation({
    mutationFn: async (payload: Omit<RankDefinition, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await (db('rank_definitions') as unknown as {
          update: (p: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
        }).update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await (db('rank_definitions') as unknown as {
          insert: (p: unknown) => Promise<{ error: unknown }>;
        }).insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-rank-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['rank-definitions'] });
      setView('list');
    },
    onError: (e: unknown) => {
      console.error(e);
      toast.error(isRTL ? 'فشل الحفظ' : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (db('rank_definitions') as unknown as {
        delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
      }).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-rank-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['rank-definitions'] });
      setDeleteTarget(null);
    },
    onError: (e: unknown) => {
      console.error(e);
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    },
  });

  // ── Sort reorder mutation ─────────────────────────────────────────
  const reorderMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: string; newOrder: number }) => {
      const { error } = await (db('rank_definitions') as unknown as {
        update: (p: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
      }).update({ sort_order: newOrder }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rank-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['rank-definitions'] });
    },
  });

  const moveRank = (rank: RankDefinition, dir: 'up' | 'down') => {
    const sorted = [...ranks].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((r) => r.id === rank.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapWith = sorted[swapIdx];
    reorderMutation.mutate({ id: rank.id, newOrder: swapWith.sort_order });
    reorderMutation.mutate({ id: swapWith.id, newOrder: rank.sort_order });
  };

  // ── Dialog open/close ────────────────────────────────────────────
  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), sort_order: ranks.length });
    setView('form');
  };

  const openEdit = (rank: RankDefinition) => {
    setEditingId(rank.id);
    setForm({
      name: rank.name,
      name_ar: rank.name_ar,
      description_en: rank.description_en,
      description_ar: rank.description_ar,
      promotion_trigger_en: rank.promotion_trigger_en,
      promotion_trigger_ar: rank.promotion_trigger_ar,
      icon: rank.icon,
      color: rank.color,
      bg_color: rank.bg_color,
      border_color: rank.border_color,
      sort_order: rank.sort_order,
      is_admin_only: rank.is_admin_only,
      req_first_course: rank.req_first_course,
      req_has_license: rank.req_has_license,
      req_motorcycle_vin: rank.req_motorcycle_vin,
      req_km_logged: rank.req_km_logged,
      req_core_training: rank.req_core_training,
      req_courses_sold_min: rank.req_courses_sold_min,
      req_courses_sold_max: rank.req_courses_sold_max,
      req_programs_sold_min: rank.req_programs_sold_min,
      req_labels: rank.req_labels ?? {},
      custom_requirements: rank.custom_requirements ?? [],
    });
    setView('form');
  };

  const handleColorSelect = (colorKey: string) => {
    const option = COLOR_OPTIONS.find((c) => c.label === colorKey);
    if (!option) return;
    setForm((prev) => ({ ...prev, color: option.color, bg_color: option.bg, border_color: option.border }));
  };

  const selectedColorLabel = COLOR_OPTIONS.find((c) => c.color === form.color)?.label ?? 'Primary';

  const submitForm = () => {
    if (!form.name.trim() || !form.name_ar.trim()) {
      toast.error(isRTL ? 'الاسم (EN) والاسم (AR) مطلوبان' : 'Name EN and Name AR are required');
      return;
    }
    upsertMutation.mutate(editingId ? { ...form, id: editingId } : form);
  };

  const openDelete = async (rank: RankDefinition) => {
    // Check how many users have this rank
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('experience_level', rank.name);
    if ((count ?? 0) > 0) {
      setDeleteBlocked(count ?? 0);
      setDeleteTarget(rank);
    } else {
      setDeleteBlocked(null);
      setDeleteTarget(rank);
    }
  };

  const sortedRanks = [...ranks].sort((a, b) => a.sort_order - b.sort_order);

  // ============================================================
  // Render
  // ============================================================

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <AdminLayout>
      <div dir={isRTL ? 'rtl' : 'ltr'}>

        {/* ══════════════════════════════════════════
            LIST VIEW
            ══════════════════════════════════════════ */}
        {view === 'list' && (
          <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {isRTL ? 'إدارة الرتب' : 'Rank Management'}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'عرض وإدارة جميع الرتب ومتطلباتها' : 'View and manage all ranks and their requirements'}
                  </p>
                </div>
              </div>
              <Button onClick={openNew} className="gap-2 shrink-0">
                <Plus className="w-4 h-4" />
                {isRTL ? 'إضافة رتبة جديدة' : 'Add New Rank'}
              </Button>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 text-center">{isRTL ? 'الترتيب' : 'Order'}</TableHead>
                        <TableHead className="w-12 text-center">{isRTL ? 'أيقونة' : 'Icon'}</TableHead>
                        <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead className="hidden md:table-cell">{isRTL ? 'الوصف' : 'Description'}</TableHead>
                        <TableHead className="text-center w-28">{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                        <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRanks.map((rank, idx) => (
                        <TableRow key={rank.id} className="group">

                          {/* Sort order + arrows */}
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-xs tabular-nums text-muted-foreground">{rank.sort_order}</span>
                              <div className="flex gap-0.5">
                                <Button
                                  variant="ghost" size="icon" className="h-5 w-5"
                                  disabled={idx === 0}
                                  onClick={() => moveRank(rank, 'up')}
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-5 w-5"
                                  disabled={idx === sortedRanks.length - 1}
                                  onClick={() => moveRank(rank, 'down')}
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>

                          {/* Icon */}
                          <TableCell className="text-center">
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center mx-auto', rank.bg_color)}>
                              <RankIcon iconName={rank.icon} className={cn('w-4 h-4', rank.color)} />
                            </div>
                          </TableCell>

                          {/* Name */}
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">{isRTL ? rank.name_ar : rank.name}</span>
                              <span className="text-[10px] text-muted-foreground" dir="ltr">{rank.name}</span>
                            </div>
                          </TableCell>

                          {/* Description */}
                          <TableCell className="hidden md:table-cell max-w-xs">
                            <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                              {isRTL ? rank.description_ar : rank.description_en}
                            </p>
                          </TableCell>

                          {/* Students count */}
                          <TableCell className="text-center">
                            <button
                              onClick={() => { setStudentsRank(rank); setStudentsSearch(''); setView('students'); }}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold transition-colors',
                                'hover:bg-primary/10 hover:text-primary',
                                (rankUsageCounts.get(rank.name) ?? 0) > 0
                                  ? 'text-foreground'
                                  : 'text-muted-foreground',
                              )}
                            >
                              <Users className="w-3.5 h-3.5 shrink-0" />
                              {rankUsageCounts.get(rank.name) ?? 0}
                            </button>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-end">
                            <div className="inline-flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(rank)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => openDelete(rank)}
                              >
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
        )}

        {/* ══════════════════════════════════════════
            FORM CHILD PAGE — Add / Edit
            ══════════════════════════════════════════ */}
        {view === 'form' && (
          <div className="space-y-6">

            {/* Page header with back navigation */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl border border-border/50 shrink-0"
                onClick={() => setView('list')}
              >
                <BackIcon className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                  form.bg_color,
                )}>
                  <RankIcon iconName={form.icon} className={cn('w-5 h-5', form.color)} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-foreground truncate">
                    {editingId
                      ? (isRTL ? `تعديل رتبة: ${form.name_ar || form.name}` : `Edit Rank: ${form.name || form.name_ar}`)
                      : (isRTL ? 'إضافة رتبة جديدة' : 'Add New Rank')}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'أدخل بيانات الرتبة الكاملة' : 'Fill in all rank details below'}
                  </p>
                </div>
              </div>

              {/* Save button in header (also shown at bottom) */}
              <div className="ms-auto shrink-0">
                <Button onClick={submitForm} disabled={upsertMutation.isPending} className="gap-2">
                  {upsertMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Save className="w-4 h-4" />
                  }
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Row 1: Basic Info (2-col) + Appearance (1-col) side by side */}
            {/* Row 2: Requirements full width */}
            <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

              {/* ── Column 1: Basic Info — spans 2 cols ── */}
              <Card className="md:col-span-2">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                    <div className="w-1.5 h-5 rounded-full bg-primary" />
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                      {isRTL ? 'المعلومات الأساسية' : 'Basic Info'}
                    </h2>
                  </div>

                  {/* Names — EN left / AR right (always LTR column order) */}
                  <div className="grid grid-cols-2 gap-3" dir="ltr">
                    <div className="space-y-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {isRTL ? 'الاسم (إنجليزي) *' : 'Name (EN) *'}
                      </Label>
                      <Input dir="ltr" placeholder="e.g. SAFE RIDER"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {isRTL ? 'الاسم (عربي) *' : 'Name (AR) *'}
                      </Label>
                      <Input dir="rtl" placeholder="مثال: راكب آمن"
                        value={form.name_ar}
                        onChange={(e) => setForm((p) => ({ ...p, name_ar: e.target.value }))}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Description — EN left / AR right */}
                  <div className="grid grid-cols-2 gap-3" dir="ltr">
                    <div className="space-y-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {isRTL ? 'الوصف (إنجليزي)' : 'Description (EN)'}
                      </Label>
                      <Textarea dir="ltr" rows={3} placeholder="Short rank description..."
                        className="p-3"
                        value={form.description_en}
                        onChange={(e) => setForm((p) => ({ ...p, description_en: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {isRTL ? 'الوصف (عربي)' : 'Description (AR)'}
                      </Label>
                      <Textarea dir="rtl" rows={3} placeholder="وصف قصير للرتبة..."
                        className="p-3"
                        value={form.description_ar}
                        onChange={(e) => setForm((p) => ({ ...p, description_ar: e.target.value }))}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Promotion triggers — EN left / AR right */}
                  <div className="grid grid-cols-2 gap-3" dir="ltr">
                    <div className="space-y-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {isRTL ? 'كيفية الترقي (إنجليزي)' : 'Promotion Trigger (EN)'}
                      </Label>
                      <Textarea dir="ltr" rows={2} placeholder="How to reach this rank..."
                        className="p-3"
                        value={form.promotion_trigger_en}
                        onChange={(e) => setForm((p) => ({ ...p, promotion_trigger_en: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {isRTL ? 'كيفية الترقي (عربي)' : 'Promotion Trigger (AR)'}
                      </Label>
                      <Textarea dir="rtl" rows={2} placeholder="كيفية الوصول لهذه الرتبة..."
                        className="p-3"
                        value={form.promotion_trigger_ar}
                        onChange={(e) => setForm((p) => ({ ...p, promotion_trigger_ar: e.target.value }))}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Sort order */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      {isRTL ? 'الترتيب في القائمة' : 'Sort Order'}
                    </Label>
                    <Input type="number" className="w-28" dir="ltr"
                      value={form.sort_order}
                      onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── Column 2: Appearance ─────────────── */}
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                    <div className="w-1.5 h-5 rounded-full bg-primary" />
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                      {isRTL ? 'المظهر' : 'Appearance'}
                    </h2>
                  </div>

                  {/* Icon selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      {isRTL ? 'الأيقونة' : 'Icon'}
                    </Label>
                    <Select value={form.icon} onValueChange={(v) => setForm((p) => ({ ...p, icon: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((name) => {
                          const Ic = ICON_MAP[name];
                          return (
                            <SelectItem key={name} value={name}>
                              <div className="flex items-center gap-2">
                                <Ic className="w-4 h-4" />
                                <span>{name}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Color selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      {isRTL ? 'اللون الرئيسي' : 'Color Theme'}
                    </Label>
                    <Select value={selectedColorLabel} onValueChange={handleColorSelect}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((opt) => (
                          <SelectItem key={opt.label} value={opt.label}>
                            <div className="flex items-center gap-2">
                              <span className={cn('w-3 h-3 rounded-full shrink-0', opt.dot)} />
                              <span>{opt.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Live preview */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      {isRTL ? 'معاينة مباشرة' : 'Live Preview'}
                    </Label>
                    <div className="flex flex-col items-center gap-4 py-4">
                      {/* Card preview */}
                      <div className={cn(
                        'flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border-2 w-full max-w-[160px]',
                        form.bg_color, form.border_color,
                      )}>
                        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center border-2', form.bg_color, form.border_color)}>
                          <RankIcon iconName={form.icon} className={cn('w-6 h-6', form.color)} />
                        </div>
                        <span className={cn('text-sm font-black text-center leading-tight', form.color)}>
                          {(isRTL ? form.name_ar : form.name) || (isRTL ? 'الرتبة' : 'Rank')}
                        </span>
                        {form.is_admin_only && (
                          <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                            {isRTL ? 'أدمن فقط' : 'Admin only'}
                          </span>
                        )}
                      </div>

                      {/* Badge preview */}
                      <div className={cn(
                        'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border',
                        form.bg_color, form.border_color, form.color,
                      )}>
                        <RankIcon iconName={form.icon} className="w-3 h-3" />
                        {(isRTL ? form.name_ar : form.name) || (isRTL ? 'الرتبة' : 'Rank')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>{/* end row-1 grid */}

            {/* Row 2: Requirements — full width */}
            <Card>
              <CardContent className="p-5 space-y-5">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                    <div className="w-1.5 h-5 rounded-full bg-primary" />
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                      {isRTL ? 'المتطلبات' : 'Requirements'}
                    </h2>
                  </div>

                  {/* Boolean requirements — 2-column grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      { key: 'req_first_course',   lblKey: 'first_course',   defEn: 'Purchase first course',          defAr: 'شراء أول كورس'               },
                      { key: 'req_has_license',    lblKey: 'has_license',    defEn: 'Verified motorcycle license',    defAr: 'رخصة دراجة موثقة'             },
                      { key: 'req_motorcycle_vin', lblKey: 'motorcycle_vin', defEn: 'Verified motorcycle VIN',        defAr: 'رقم هيكل الدراجة (VIN) موثق'  },
                      { key: 'req_core_training',  lblKey: 'core_training',  defEn: 'Complete core training',         defAr: 'إتمام التدريب الأساسي'         },
                      { key: 'is_admin_only',      lblKey: 'admin_only',     defEn: 'Requires admin approval',        defAr: 'يتطلب موافقة الأدمن يدوياً'   },
                    ] as { key: string; lblKey: keyof ReqLabels extends `${infer K}_en` ? never : string; defEn: string; defAr: string }[]
                  ).map(({ key, lblKey, defEn, defAr }) => {
                    const isChecked = Boolean(form[key as keyof typeof form]);
                    const enKey = `${lblKey}_en` as keyof ReqLabels;
                    const arKey = `${lblKey}_ar` as keyof ReqLabels;
                    return (
                      <div
                        key={key}
                        className={cn(
                          'rounded-xl border transition-colors overflow-hidden',
                          isChecked ? 'border-primary/25 bg-primary/5' : 'border-border/40 bg-muted/10',
                        )}
                      >
                        {/* Checkbox row */}
                        <label
                          htmlFor={`cp-${key}`}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                        >
                          <Checkbox
                            id={`cp-${key}`}
                            checked={isChecked}
                            onCheckedChange={(v) => setForm((p) => ({ ...p, [key]: Boolean(v) }))}
                          />
                          <span className={cn('text-sm font-semibold flex-1', isChecked ? 'text-foreground' : 'text-muted-foreground')}>
                            {isRTL ? defAr : defEn}
                          </span>
                        </label>
                        {/* Expanded label editor */}
                        {isChecked && (
                          <div className="px-4 pb-4 space-y-3 border-t border-primary/10 pt-3">
                            <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-wider">
                              {isRTL ? 'تخصيص النص (اختياري)' : 'Custom label (optional)'}
                            </p>
                            <div className="space-y-2">
                              <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground font-medium" dir="ltr">EN</p>
                                <Input
                                  dir="ltr"
                                  className="h-9"
                                  value={form.req_labels[enKey] || defEn}
                                  onChange={(e) => setForm((p) => ({
                                    ...p,
                                    req_labels: { ...p.req_labels, [enKey]: e.target.value },
                                  }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground font-medium" dir="rtl">AR</p>
                                <Input
                                  dir="rtl"
                                  className="h-9"
                                  value={form.req_labels[arKey] || defAr}
                                  onChange={(e) => setForm((p) => ({
                                    ...p,
                                    req_labels: { ...p.req_labels, [arKey]: e.target.value },
                                  }))}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>{/* end boolean grid */}

                  <Separator />

                  {/* Numeric requirements — 3 columns horizontal */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                  {/* KM logged */}
                  <div className={cn(
                    'rounded-xl border overflow-hidden transition-colors',
                    form.req_km_logged ? 'border-primary/25 bg-primary/5' : 'border-border/40 bg-muted/10',
                  )}>
                    <label htmlFor="cp-req_km_logged_chk" className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                      <Checkbox
                        id="cp-req_km_logged_chk"
                        checked={form.req_km_logged !== null && form.req_km_logged > 0}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, req_km_logged: v ? 1500 : null }))}
                      />
                      <span className={cn('text-sm font-semibold flex-1', form.req_km_logged ? 'text-foreground' : 'text-muted-foreground')}>
                        {isRTL ? 'كيلومترات مسجلة' : 'KM logged'}
                      </span>
                    </label>
                    {form.req_km_logged !== null && (
                      <div className="px-4 pb-4 space-y-3 border-t border-primary/10 pt-3">
                        <div className="space-y-1.5" dir="ltr">
                          <p className="text-xs text-muted-foreground font-medium">{isRTL ? 'الحد الأدنى (كم)' : 'Min km'}</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" dir="ltr" className="h-9 flex-1"
                              value={form.req_km_logged ?? ''}
                              onChange={(e) => setForm((p) => ({ ...p, req_km_logged: Number(e.target.value) || null }))}
                              placeholder="1500"
                            />
                            <span className="text-sm text-muted-foreground font-medium shrink-0">km</span>
                          </div>
                        </div>
                        <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-wider">
                          {isRTL ? 'تخصيص النص (اختياري)' : 'Custom label (optional)'}
                        </p>
                        <div className="space-y-2">
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium" dir="ltr">EN</p>
                            <Input dir="ltr" className="h-9"
                              value={form.req_labels.km_logged_en || '1,500 km logged'}
                              onChange={(e) => setForm((p) => ({ ...p, req_labels: { ...p.req_labels, km_logged_en: e.target.value } }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium" dir="rtl">AR</p>
                            <Input dir="rtl" className="h-9"
                              value={form.req_labels.km_logged_ar || '1,500 كم مسجلة'}
                              onChange={(e) => setForm((p) => ({ ...p, req_labels: { ...p.req_labels, km_logged_ar: e.target.value } }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Courses sold */}
                  <div className={cn(
                    'rounded-xl border overflow-hidden transition-colors',
                    form.req_courses_sold_min !== null ? 'border-primary/25 bg-primary/5' : 'border-border/40 bg-muted/10',
                  )}>
                    <label htmlFor="cp-req_courses_chk" className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                      <Checkbox
                        id="cp-req_courses_chk"
                        checked={form.req_courses_sold_min !== null}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, req_courses_sold_min: v ? 1 : null, req_courses_sold_max: null }))}
                      />
                      <span className={cn('text-sm font-semibold flex-1', form.req_courses_sold_min !== null ? 'text-foreground' : 'text-muted-foreground')}>
                        {isRTL ? 'بيع كورسات' : 'Courses sold'}
                      </span>
                    </label>
                    {form.req_courses_sold_min !== null && (
                      <div className="px-4 pb-4 space-y-3 border-t border-primary/10 pt-3">
                        <div className="grid grid-cols-2 gap-2" dir="ltr">
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium">Min</p>
                            <Input type="number" dir="ltr" className="h-9"
                              value={form.req_courses_sold_min ?? ''} placeholder="1"
                              onChange={(e) => setForm((p) => ({ ...p, req_courses_sold_min: Number(e.target.value) || null }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium">Max</p>
                            <Input type="number" dir="ltr" className="h-9"
                              value={form.req_courses_sold_max ?? ''} placeholder={isRTL ? 'بلا حد' : 'none'}
                              onChange={(e) => setForm((p) => ({ ...p, req_courses_sold_max: Number(e.target.value) || null }))}
                            />
                          </div>
                        </div>
                        <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-wider">
                          {isRTL ? 'تخصيص النص (اختياري)' : 'Custom label (optional)'}
                        </p>
                        <div className="space-y-2">
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium" dir="ltr">EN</p>
                            <Input dir="ltr" className="h-9"
                              value={form.req_labels.courses_sold_en || 'Sold an original course'}
                              onChange={(e) => setForm((p) => ({ ...p, req_labels: { ...p.req_labels, courses_sold_en: e.target.value } }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium" dir="rtl">AR</p>
                            <Input dir="rtl" className="h-9"
                              value={form.req_labels.courses_sold_ar || 'بيع كورس أصلي'}
                              onChange={(e) => setForm((p) => ({ ...p, req_labels: { ...p.req_labels, courses_sold_ar: e.target.value } }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Programs sold */}
                  <div className={cn(
                    'rounded-xl border overflow-hidden transition-colors',
                    form.req_programs_sold_min !== null ? 'border-primary/25 bg-primary/5' : 'border-border/40 bg-muted/10',
                  )}>
                    <label htmlFor="cp-req_programs_chk" className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                      <Checkbox
                        id="cp-req_programs_chk"
                        checked={form.req_programs_sold_min !== null}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, req_programs_sold_min: v ? 4 : null }))}
                      />
                      <span className={cn('text-sm font-semibold flex-1', form.req_programs_sold_min !== null ? 'text-foreground' : 'text-muted-foreground')}>
                        {isRTL ? 'بيع برامج تدريبية' : 'Training programs sold'}
                      </span>
                    </label>
                    {form.req_programs_sold_min !== null && (
                      <div className="px-4 pb-4 space-y-3 border-t border-primary/10 pt-3">
                        <div className="space-y-1.5" dir="ltr">
                          <p className="text-xs text-muted-foreground font-medium">{isRTL ? 'الحد الأدنى' : 'Min programs'}</p>
                          <div className="flex items-center gap-2">
                            <Input type="number" dir="ltr" className="h-9 flex-1"
                              value={form.req_programs_sold_min ?? ''} placeholder="4"
                              onChange={(e) => setForm((p) => ({ ...p, req_programs_sold_min: Number(e.target.value) || null }))}
                            />
                            <span className="text-sm text-muted-foreground font-medium shrink-0">{isRTL ? 'برنامج' : 'prog.'}</span>
                          </div>
                        </div>
                        <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-wider">
                          {isRTL ? 'تخصيص النص (اختياري)' : 'Custom label (optional)'}
                        </p>
                        <div className="space-y-2">
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium" dir="ltr">EN</p>
                            <Input dir="ltr" className="h-9"
                              value={form.req_labels.programs_sold_en || 'Sold 4+ training programs'}
                              onChange={(e) => setForm((p) => ({ ...p, req_labels: { ...p.req_labels, programs_sold_en: e.target.value } }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium" dir="rtl">AR</p>
                            <Input dir="rtl" className="h-9"
                              value={form.req_labels.programs_sold_ar || 'بيع 4+ برامج تدريبية'}
                              onChange={(e) => setForm((p) => ({ ...p, req_labels: { ...p.req_labels, programs_sold_ar: e.target.value } }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>{/* end 3-col numeric grid */}

                  <Separator />

                  {/* Custom (freeform) requirements */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {isRTL ? 'متطلبات مخصصة' : 'Custom Requirements'}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary"
                        onClick={() => setForm((p) => ({
                          ...p,
                          custom_requirements: [...p.custom_requirements, { label_en: '', label_ar: '' }],
                        }))}
                      >
                        <Plus className="w-3 h-3" />
                        {isRTL ? 'إضافة' : 'Add'}
                      </Button>
                    </div>

                    {form.custom_requirements.length === 0 && (
                      <p className="text-xs text-muted-foreground italic px-1">
                        {isRTL
                          ? 'لا توجد متطلبات مخصصة. اضغط إضافة لإنشاء واحدة.'
                          : 'No custom requirements. Click Add to create one.'}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {form.custom_requirements.map((cr, idx) => (
                      <div key={idx} className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                        {/* Card header */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/5">
                          <span className="text-xs font-semibold text-primary/70 uppercase tracking-wide">
                            {isRTL ? `متطلب مخصص ${idx + 1}` : `Custom #${idx + 1}`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setForm((p) => ({
                              ...p,
                              custom_requirements: p.custom_requirements.filter((_, i) => i !== idx),
                            }))}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {/* Fields */}
                        <div className="px-4 py-3 space-y-2.5">
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium" dir="ltr">EN</p>
                            <Input
                              dir="ltr"
                              className="h-9"
                              placeholder="Requirement text..."
                              value={cr.label_en}
                              onChange={(e) => setForm((p) => ({
                                ...p,
                                custom_requirements: p.custom_requirements.map((r, i) =>
                                  i === idx ? { ...r, label_en: e.target.value } : r
                                ),
                              }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-medium" dir="rtl">AR</p>
                            <Input
                              dir="rtl"
                              className="h-9"
                              placeholder="نص المتطلب..."
                              value={cr.label_ar}
                              onChange={(e) => setForm((p) => ({
                                ...p,
                                custom_requirements: p.custom_requirements.map((r, i) =>
                                  i === idx ? { ...r, label_ar: e.target.value } : r
                                ),
                              }))}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>{/* end custom req grid */}
                  </div>
                </CardContent>
              </Card>
            </div>{/* end space-y-6 */}

            {/* Bottom action bar */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/40">
              <Button variant="outline" onClick={() => setView('list')} className="gap-2">
                <BackIcon className="w-4 h-4" />
                {isRTL ? 'رجوع' : 'Back'}
              </Button>
              <Button onClick={submitForm} disabled={upsertMutation.isPending} className="gap-2 px-8">
                {upsertMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            STUDENTS CHILD PAGE
            ══════════════════════════════════════════ */}
        {view === 'students' && studentsRank && (
          <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => { setView('list'); setStudentsRank(null); }} className="gap-2 self-start">
                <BackIcon className="w-4 h-4" />
                {isRTL ? 'رجوع' : 'Back'}
              </Button>
              <div className="flex items-center gap-3 flex-1">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', studentsRank.bg_color)}>
                  <RankIcon iconName={studentsRank.icon} className={cn('w-5 h-5', studentsRank.color)} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {isRTL ? studentsRank.name_ar : studentsRank.name}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {rankUsageCounts.get(studentsRank.name) ?? 0} {isRTL ? 'طالب في هذه الرتبة' : 'students in this rank'}
                  </p>
                </div>
              </div>
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={isRTL ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                  value={studentsSearch}
                  onChange={(e) => setStudentsSearch(e.target.value)}
                  className="w-full h-9 ps-9 pe-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Students Table */}
            <Card>
              <CardContent className="p-0">
                {studentsLoading ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Users className="w-10 h-10 opacity-30" />
                    <p className="text-sm">
                      {studentsSearch
                        ? (isRTL ? 'لا توجد نتائج للبحث' : 'No results found')
                        : (isRTL ? 'لا يوجد طلاب في هذه الرتبة' : 'No students in this rank yet')}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                        <TableHead className="hidden md:table-cell">{isRTL ? 'الموقع' : 'Location'}</TableHead>
                        <TableHead>{isRTL ? 'الرتبة الحالية' : 'Current Rank'}</TableHead>
                        <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => {
                        const sRank = ranks.find((r) => r.name === student.experience_level);
                        return (
                          <TableRow key={student.id}>
                            {/* Avatar + Name */}
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={student.avatar_url || ''} />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                    {student.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm text-foreground">
                                    {student.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground" dir="ltr">
                                    {new Date(student.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            {/* Phone */}
                            <TableCell>
                              <span className="text-sm text-muted-foreground" dir="ltr">
                                {student.phone || '—'}
                              </span>
                            </TableCell>
                            {/* Location */}
                            <TableCell className="hidden md:table-cell">
                              <span className="text-sm text-muted-foreground">
                                {[resolveCity(student.city, isRTL), resolveCountry(student.country, isRTL)].filter(Boolean).join('، ') || '—'}
                              </span>
                            </TableCell>
                            {/* Current Rank */}
                            <TableCell>
                              {sRank ? (
                                <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold', sRank.bg_color, sRank.border_color)}>
                                  <RankIcon iconName={sRank.icon} className={cn('w-3 h-3', sRank.color)} />
                                  <span className={sRank.color}>{isRTL ? sRank.name_ar : sRank.name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {student.experience_level || '—'}
                                </span>
                              )}
                              {student.rank_override && (
                                <Badge variant="outline" className="ms-1 text-[9px] border-primary/30 text-primary">
                                  {isRTL ? 'يدوي' : 'Manual'}
                                </Badge>
                              )}
                            </TableCell>
                            {/* Actions */}
                            <TableCell className="text-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs h-8"
                                onClick={() => { setSelectedStudent(student); setSelectedRankForPromotion(''); }}
                              >
                                <Pencil className="w-3 h-3" />
                                {isRTL ? 'تغيير الرتبة' : 'Change Rank'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════
          Rank Selection Dialog (for student rank change)
          ══════════════════════════════════════════ */}
      {selectedStudent && !showPromoteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="w-full max-w-lg bg-background rounded-2xl shadow-2xl overflow-hidden"
            dir={isRTL ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div>
                <h3 className="font-bold text-foreground">
                  {isRTL ? 'تغيير رتبة الطالب' : 'Change Student Rank'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedStudent.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedStudent(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {/* Rank grid */}
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
              {sortedRanks.map((rank) => {
                const isCurrent = rank.name === selectedStudent.experience_level;
                return (
                  <button
                    key={rank.id}
                    disabled={isCurrent}
                    onClick={() => { openPromote(selectedStudent, rank.name); }}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center',
                      'hover:scale-[1.02] active:scale-[0.98]',
                      isCurrent
                        ? 'border-primary bg-primary/10 cursor-default'
                        : 'border-border/30 bg-muted/10 hover:border-primary/40 hover:bg-primary/5 cursor-pointer',
                    )}
                  >
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', rank.bg_color)}>
                      <RankIcon iconName={rank.icon} className={cn('w-4 h-4', rank.color)} />
                    </div>
                    <span className={cn('text-xs font-semibold leading-tight', isCurrent ? 'text-primary' : 'text-foreground')}>
                      {isRTL ? rank.name_ar : rank.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                        {isRTL ? 'الحالية' : 'Current'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          Promote Confirmation AlertDialog
          ══════════════════════════════════════════ */}
      <AlertDialog open={showPromoteConfirm} onOpenChange={(o) => { if (!o) { setShowPromoteConfirm(false); } }}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              {isRTL
                ? `ترقية ${selectedStudent?.full_name ?? ''} إلى ${ranks.find((r) => r.name === selectedRankForPromotion)?.[isRTL ? 'name_ar' : 'name'] ?? selectedRankForPromotion}`
                : `Promote ${selectedStudent?.full_name ?? ''} to ${ranks.find((r) => r.name === selectedRankForPromotion)?.name ?? selectedRankForPromotion}`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-2">
                {/* Requirements checklist */}
                {promotionChecks.length > 0 && (
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {isRTL ? 'متطلبات الرتبة' : 'Rank Requirements'}
                      </p>
                    </div>
                    <div className="divide-y divide-border/20">
                      {promotionChecks.map((check, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                          {check.met ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive/70 shrink-0" />
                          )}
                          <span className={cn(
                            'text-sm',
                            check.met ? 'text-foreground' : 'text-muted-foreground',
                            check.isAdminOnly && 'text-primary',
                          )}>
                            {isRTL ? check.label_ar : check.label_en}
                          </span>
                          {check.isAdminOnly && (
                            <span className="ms-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                              {isRTL ? 'أدمن فقط' : 'Admin only'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Warning / success */}
                {promotionChecks.some((c) => !c.met && !c.isAdminOnly) ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      {isRTL
                        ? 'بعض المتطلبات غير مكتملة. سيتم تفعيل الرتبة يدوياً بصلاحية الأدمن.'
                        : 'Some requirements are not met. Admin override will activate this rank manually.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {isRTL ? 'جميع المتطلبات مكتملة ✅' : 'All requirements are met ✅'}
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowPromoteConfirm(false); }}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={promoteStudentMutation.isPending}
              onClick={() => selectedStudent && promoteStudentMutation.mutate({ userId: selectedStudent.user_id, newRank: selectedRankForPromotion })}
              className="gap-2"
            >
              {promoteStudentMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trophy className="w-4 h-4" />}
              {isRTL ? 'تفعيل الرتبة' : 'Activate Rank'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════
          Delete Confirmation (AlertDialog)
          ══════════════════════════════════════════ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'حذف الرتبة' : 'Delete Rank'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {deleteBlocked !== null && deleteBlocked > 0 ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {isRTL
                        ? `لا يمكن حذف هذا التصنيف — يوجد ${deleteBlocked} مستخدم بهذا التصنيف`
                        : `Cannot delete — ${deleteBlocked} user(s) currently have this rank`}
                    </span>
                  </div>
                ) : (
                  <span>
                    {isRTL
                      ? `هل أنت متأكد من حذف رتبة "${deleteTarget?.name_ar ?? ''}"؟ لا يمكن التراجع.`
                      : `Are you sure you want to delete "${deleteTarget?.name ?? ''}"? This cannot be undone.`}
                  </span>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            {!(deleteBlocked !== null && deleteBlocked > 0) && (
              <AlertDialogAction
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRTL ? 'حذف' : 'Delete'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminRanks;
