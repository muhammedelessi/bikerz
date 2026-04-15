import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminCoupons } from '@/hooks/admin/useAdminCoupons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/useAuditLog';
import { format } from 'date-fns';
import {
  Tag, Plus, Search, MoreHorizontal, Copy, Trash2, Pencil, ToggleLeft,
  BarChart3, TrendingUp, Ticket, Users, DollarSign, Calendar, Eye,
  AlertTriangle, CheckCircle, XCircle, Clock, Percent, Hash, Download, Pause, Play, ChevronDown,
} from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  description: string | null;
  description_ar: string | null;
  course_id: string | null;
  is_global: boolean;
  start_date: string;
  expiry_date: string;
  max_usage: number;
  used_count: number;
  max_per_user: number;
  status: string;
  is_deleted: boolean;
  affiliate_id: string | null;
  is_stackable: boolean;
  minimum_amount: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CouponSeries {
  id: string;
  prefix: string;
  range_from: number;
  range_to: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses_per_code: number;
  expiry_date: string | null;
  course_id: string | null;
  is_global: boolean;
  status: 'active' | 'paused' | 'expired';
  created_by: string | null;
  created_at: string;
  description: string | null;
}

const defaultForm = {
  code: '',
  type: 'percentage_discount' as string,
  value: 0,
  description: '',
  description_ar: '',
  course_id: '' as string,
  is_global: true,
  start_date: new Date().toISOString().slice(0, 16),
  expiry_date: '',
  max_usage: 100,
  max_per_user: 1,
  is_stackable: false,
  minimum_amount: 0,
};

const AdminCoupons: React.FC = () => {
  const { useRQ, useRM, queryClient, dbFrom } = useAdminCoupons();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewUsage, setViewUsage] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [activeTab, setActiveTab] = useState<'coupons' | 'series'>('coupons');
  const [expandedSeriesId, setExpandedSeriesId] = useState<string | null>(null);
  const [seriesSearch, setSeriesSearch] = useState('');
  const [seriesUsageSearch, setSeriesUsageSearch] = useState('');
  const [seriesForm, setSeriesForm] = useState({
    prefix: '',
    range_from: 200,
    range_to: 999,
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 20,
    max_uses_per_code: 1,
    expiry_date: '',
    is_global: true,
    course_id: '',
    description: '',
  });

  // Fetch coupons
  const { data: coupons, isLoading } = useRQ({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });

  // Fetch courses for scope dropdown
  const { data: courses } = useRQ({
    queryKey: ['admin-courses-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .order('title');
      if (error) throw error;
      return data;
    },
  });

  const { data: seriesList, isLoading: seriesLoading } = useRQ({
    queryKey: ['admin-coupon-series'],
    queryFn: async () => {
      const { data, error } = await dbFrom('coupon_series')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CouponSeries[];
    },
  });

  const { data: seriesUsageCodesMap } = useRQ({
    queryKey: ['admin-coupon-series-used-map'],
    queryFn: async () => {
      const { data, error } = await dbFrom('coupon_series_usage').select('series_id, code_number');
      if (error) throw error;
      const map = new Map<string, Set<number>>();
      (data || []).forEach((row: any) => {
        if (!map.has(row.series_id)) map.set(row.series_id, new Set<number>());
        map.get(row.series_id)!.add(Number(row.code_number));
      });
      return map;
    },
  });

  const { data: expandedSeriesUsage, isLoading: expandedSeriesUsageLoading } = useRQ({
    queryKey: ['admin-coupon-series-usage', expandedSeriesId],
    enabled: !!expandedSeriesId,
    queryFn: async () => {
      const { data: usage, error } = await dbFrom('coupon_series_usage')
        .select('*')
        .eq('series_id', expandedSeriesId!)
        .order('used_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      const logs = usage || [];
      if (logs.length === 0) return [];

      const userIds = [...new Set(logs.map((l: any) => l.user_id).filter(Boolean))];
      const courseIds = [...new Set(logs.map((l: any) => l.course_id).filter(Boolean))];

      const [profilesRes, coursesRes] = await Promise.all([
        userIds.length > 0
          ? dbFrom('profiles').select('user_id, full_name, phone').in('user_id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length > 0
          ? dbFrom('courses').select('id, title, title_ar').in('id', courseIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      let emailMap = new Map<string, string>();
      try {
        const { data: emailsData } = await supabase.rpc('get_all_user_emails') as any;
        if (emailsData) emailMap = new Map(emailsData.map((e: any) => [e.user_id, e.email]));
      } catch {}

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const courseMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c]));

      return logs.map((row: any) => ({
        ...row,
        _profile: profileMap.get(row.user_id) || null,
        _email: emailMap.get(row.user_id) || null,
        _course: row.course_id ? courseMap.get(row.course_id) || null : null,
      }));
    },
  });

  // Fetch usage logs for a coupon
  const { data: usageLogs, isLoading: usageLoading } = useRQ({
    queryKey: ['coupon-usage', viewUsage],
    enabled: !!viewUsage,
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('coupon_usage_logs')
        .select('*')
        .eq('coupon_id', viewUsage!)
        .order('applied_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!logs || logs.length === 0) return [];

      // Fetch user profiles and course names in parallel
      const userIds = [...new Set(logs.map(l => l.user_id))];
      const courseIds = [...new Set(logs.map(l => l.course_id).filter(Boolean))] as string[];

      const [profilesRes, coursesRes] = await Promise.all([
        dbFrom('profiles').select('user_id, full_name, phone').in('user_id', userIds),
        courseIds.length > 0
          ? dbFrom('courses').select('id, title, title_ar').in('id', courseIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // Fetch emails separately to handle potential RPC errors gracefully
      let emailMap = new Map<string, string>();
      try {
        const { data: emailsData } = await supabase.rpc('get_all_user_emails') as any;
        if (emailsData) {
          emailMap = new Map(emailsData.map((e: any) => [e.user_id, e.email]));
        }
      } catch {}

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const courseMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c]));

      return logs.map(log => ({
        ...log,
        _profile: profileMap.get(log.user_id) || null,
        _email: emailMap.get(log.user_id) || null,
        _course: log.course_id ? courseMap.get(log.course_id) || null : null,
      }));
    },
  });

  // Create coupon
  const createMutation = useRM({
    mutationFn: async (data: typeof formData) => {
      const { error } = await dbFrom('coupons').insert({
        code: data.code.trim(),
        type: data.type,
        value: data.value,
        description: data.description || null,
        description_ar: data.description_ar || null,
        course_id: data.course_id || null,
        is_global: data.is_global,
        start_date: new Date(data.start_date).toISOString(),
        expiry_date: new Date(data.expiry_date).toISOString(),
        max_usage: data.max_usage,
        max_per_user: data.max_per_user,
        is_stackable: data.is_stackable,
        minimum_amount: data.minimum_amount,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setIsFormOpen(false);
      setFormData(defaultForm);
      toast.success(isRTL ? 'تم إنشاء الكوبون بنجاح' : 'Coupon created successfully');
    },
    onError: (error: any) => {
      if (error.message?.includes('idx_coupons_code_normalized')) {
        toast.error(isRTL ? 'رمز الكوبون مستخدم بالفعل' : 'Coupon code already exists');
      } else {
        toast.error(error.message || (isRTL ? 'فشل إنشاء الكوبون' : 'Failed to create coupon'));
      }
    },
  });

  // Update coupon
  const updateMutation = useRM({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('coupons')
        .update({
          code: data.code.trim(),
          type: data.type,
          value: data.value,
          description: data.description || null,
          description_ar: data.description_ar || null,
          course_id: data.course_id || null,
          is_global: data.is_global,
          start_date: new Date(data.start_date).toISOString(),
          expiry_date: new Date(data.expiry_date).toISOString(),
          max_usage: data.max_usage,
          max_per_user: data.max_per_user,
          is_stackable: data.is_stackable,
          minimum_amount: data.minimum_amount,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setEditingCoupon(null);
      setIsFormOpen(false);
      setFormData(defaultForm);
      toast.success(isRTL ? 'تم تحديث الكوبون' : 'Coupon updated');
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? 'فشل التحديث' : 'Failed to update'));
    },
  });

  // Toggle status
  const toggleMutation = useRM({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === 'active' ? 'inactive' : 'active';
      const { error } = await dbFrom('coupons').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success(newStatus === 'active'
        ? (isRTL ? 'تم تفعيل الكوبون' : 'Coupon activated')
        : (isRTL ? 'تم إيقاف الكوبون' : 'Coupon deactivated')
      );
    },
  });

  // Soft delete
  const deleteMutation = useRM({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('coupons')
        .update({ is_deleted: true, status: 'inactive' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setDeleteConfirm(null);
      toast.success(isRTL ? 'تم حذف الكوبون' : 'Coupon deleted');
    },
  });

  const createSeriesMutation = useRM({
    mutationFn: async () => {
      const prefix = seriesForm.prefix.trim().toUpperCase();
      if (!prefix) throw new Error(isRTL ? 'البادئة مطلوبة' : 'Prefix is required');
      if (seriesForm.range_to <= seriesForm.range_from) {
        throw new Error(isRTL ? 'قيمة "إلى" يجب أن تكون أكبر من "من"' : '"To" must be greater than "From"');
      }
      if (seriesForm.discount_value <= 0) {
        throw new Error(isRTL ? 'قيمة الخصم يجب أن تكون أكبر من صفر' : 'Discount value must be greater than zero');
      }

      const { error } = await dbFrom('coupon_series').insert({
        prefix,
        range_from: seriesForm.range_from,
        range_to: seriesForm.range_to,
        discount_type: seriesForm.discount_type,
        discount_value: seriesForm.discount_value,
        max_uses_per_code: seriesForm.max_uses_per_code,
        expiry_date: seriesForm.expiry_date ? new Date(seriesForm.expiry_date).toISOString() : null,
        course_id: seriesForm.is_global ? null : seriesForm.course_id || null,
        is_global: seriesForm.is_global,
        status: 'active',
        created_by: user?.id || null,
        description: seriesForm.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupon-series'] });
      toast.success(isRTL ? 'تم إنشاء السلسلة بنجاح' : 'Series created successfully');
      setSeriesForm({
        prefix: '',
        range_from: 200,
        range_to: 999,
        discount_type: 'percentage',
        discount_value: 20,
        max_uses_per_code: 1,
        expiry_date: '',
        is_global: true,
        course_id: '',
        description: '',
      });
    },
    onError: (error: any) => toast.error(error.message || (isRTL ? 'فشل إنشاء السلسلة' : 'Failed to create series')),
  });

  const toggleSeriesStatusMutation = useRM({
    mutationFn: async (series: CouponSeries) => {
      const nextStatus = series.status === 'active' ? 'paused' : 'active';
      const { error } = await dbFrom('coupon_series').update({ status: nextStatus }).eq('id', series.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupon-series'] }),
  });

  const deleteSeriesMutation = useRM({
    mutationFn: async (seriesId: string) => {
      const { error } = await dbFrom('coupon_series').delete().eq('id', seriesId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupon-series'] });
      queryClient.invalidateQueries({ queryKey: ['admin-coupon-series-used-map'] });
      toast.success(isRTL ? 'تم حذف السلسلة' : 'Series deleted');
    },
    onError: (error: any) => toast.error(error.message || (isRTL ? 'فشل حذف السلسلة' : 'Failed to delete series')),
  });

  // Duplicate
  const duplicateCoupon = (coupon: Coupon) => {
    setFormData({
      code: coupon.code + '_COPY',
      type: coupon.type,
      value: Number(coupon.value),
      description: coupon.description || '',
      description_ar: coupon.description_ar || '',
      course_id: coupon.course_id || '',
      is_global: coupon.is_global,
      start_date: new Date().toISOString().slice(0, 16),
      expiry_date: coupon.expiry_date ? new Date(coupon.expiry_date).toISOString().slice(0, 16) : '',
      max_usage: coupon.max_usage,
      max_per_user: coupon.max_per_user,
      is_stackable: coupon.is_stackable,
      minimum_amount: Number(coupon.minimum_amount) || 0,
    });
    setEditingCoupon(null);
    setIsFormOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      description: coupon.description || '',
      description_ar: coupon.description_ar || '',
      course_id: coupon.course_id || '',
      is_global: coupon.is_global,
      start_date: new Date(coupon.start_date).toISOString().slice(0, 16),
      expiry_date: new Date(coupon.expiry_date).toISOString().slice(0, 16),
      max_usage: coupon.max_usage,
      max_per_user: coupon.max_per_user,
      is_stackable: coupon.is_stackable,
      minimum_amount: Number(coupon.minimum_amount) || 0,
    });
    setEditingCoupon(coupon);
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.code.trim()) {
      toast.error(isRTL ? 'رمز الكوبون مطلوب' : 'Coupon code is required');
      return;
    }
    if (!formData.expiry_date) {
      toast.error(isRTL ? 'تاريخ الانتهاء مطلوب' : 'Expiry date is required');
      return;
    }
    if (formData.value <= 0) {
      toast.error(isRTL ? 'القيمة يجب أن تكون أكبر من صفر' : 'Value must be greater than zero');
      return;
    }
    if (formData.type === 'percentage_discount' && formData.value > 100) {
      toast.error(isRTL ? 'نسبة الخصم لا تتجاوز 100%' : 'Percentage cannot exceed 100%');
      return;
    }

    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filtered = coupons?.filter((c) => {
    const matchesSearch = c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredSeries = (seriesList || []).filter((series) => {
    const rangeText = `${series.prefix}${series.range_from} ${series.prefix}${series.range_to}`.toLowerCase();
    const q = seriesSearch.toLowerCase();
    return !q || rangeText.includes(q) || (series.description || '').toLowerCase().includes(q);
  });

  const filteredExpandedUsage = (expandedSeriesUsage || []).filter((row: any) => {
    const q = seriesUsageSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(row.code_used || '').toLowerCase().includes(q) ||
      String(row.code_number || '').includes(q) ||
      String(row._profile?.full_name || '').toLowerCase().includes(q) ||
      String(row._email || '').toLowerCase().includes(q)
    );
  });

  // Stats
  const totalActive = coupons?.filter(c => c.status === 'active').length || 0;
  const totalExpired = coupons?.filter(c => c.status === 'expired').length || 0;
  const totalUsed = coupons?.reduce((sum, c) => sum + c.used_count, 0) || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 me-1" />{isRTL ? 'نشط' : 'Active'}</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="w-3 h-3 me-1" />{isRTL ? 'متوقف' : 'Inactive'}</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 me-1" />{isRTL ? 'منتهي' : 'Expired'}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'percentage_discount':
        return <Badge variant="secondary"><Percent className="w-3 h-3 me-1" />{isRTL ? 'نسبة' : 'Percentage'}</Badge>;
      case 'fixed_amount_discount':
        return <Badge variant="secondary"><DollarSign className="w-3 h-3 me-1" />{isRTL ? 'مبلغ ثابت' : 'Fixed'}</Badge>;
      case 'promotion':
        return <Badge variant="secondary"><Tag className="w-3 h-3 me-1" />{isRTL ? 'عرض' : 'Promotion'}</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const stats = [
    { titleEn: 'Total Codes', titleAr: 'إجمالي الرموز', value: coupons?.length || 0, icon: Ticket, color: 'text-primary', bg: 'bg-primary/10' },
    { titleEn: 'Active', titleAr: 'نشطة', value: totalActive, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    { titleEn: 'Expired', titleAr: 'منتهية', value: totalExpired, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { titleEn: 'Total Uses', titleAr: 'إجمالي الاستخدام', value: totalUsed, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  const getSeriesStatusBadge = (status: CouponSeries['status']) => {
    if (status === 'active') {
      return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">{isRTL ? 'نشط' : 'Active'}</Badge>;
    }
    if (status === 'paused') {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{isRTL ? 'موقوف' : 'Paused'}</Badge>;
    }
    return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">{isRTL ? 'منتهي' : 'Expired'}</Badge>;
  };

  const exportSeriesUsageCsv = () => {
    if (!expandedSeriesId || filteredExpandedUsage.length === 0) return;
    const rows = filteredExpandedUsage.map((row: any) => ({
      code: row.code_used,
      user_name: row._profile?.full_name || '',
      user_email: row._email || '',
      course_name: row._course ? (isRTL ? row._course.title_ar || row._course.title : row._course.title) : '',
      original_amount: row.original_amount,
      discount_amount: row.discount_amount,
      final_amount: row.final_amount,
      used_at: row.used_at,
    }));
    const header = Object.keys(rows[0]).join(',');
    const body = rows
      .map((r) => Object.values(r).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coupon-series-usage-${expandedSeriesId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'إدارة الكوبونات والعروض' : 'Coupons & Promotions'}
            </h1>
            <p className="text-muted-foreground">
              {isRTL ? 'إنشاء وإدارة رموز الخصم والعروض الترويجية' : 'Create and manage discount codes and promotions'}
            </p>
          </div>
          <Button
            onClick={() => {
              if (activeTab === 'coupons') {
                setEditingCoupon(null);
                setFormData(defaultForm);
                setIsFormOpen(true);
                return;
              }
              document.getElementById('dynamic-series-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {activeTab === 'coupons' ? (
              <>
                <Plus className="w-4 h-4 me-2" />
                {isRTL ? 'كوبون جديد' : 'New Coupon'}
              </>
            ) : (
              <>
                <Hash className="w-4 h-4 me-2" />
                {isRTL ? 'سلسلة ديناميكية' : 'Dynamic Series'}
              </>
            )}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'coupons' | 'series')} className="w-full">
          <TabsList>
            <TabsTrigger value="coupons">{isRTL ? 'الكوبونات' : 'Coupons'}</TabsTrigger>
            <TabsTrigger value="series">{isRTL ? 'الكودات الديناميكية' : 'Dynamic Series'}</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'coupons' && (
        <>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? stat.titleAr : stat.titleEn}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bg}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={isRTL ? 'بحث بالرمز أو الوصف...' : 'Search by code or description...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
                <TabsList>
                  <TabsTrigger value="all">{isRTL ? 'الكل' : 'All'}</TabsTrigger>
                  <TabsTrigger value="active">{isRTL ? 'نشط' : 'Active'}</TabsTrigger>
                  <TabsTrigger value="inactive">{isRTL ? 'متوقف' : 'Inactive'}</TabsTrigger>
                  <TabsTrigger value="expired">{isRTL ? 'منتهي' : 'Expired'}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {activeTab === 'coupons' && (
        <>
        {/* Coupons Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'الكوبونات' : 'Coupons'}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الرمز' : 'Code'}</TableHead>
                    <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{isRTL ? 'القيمة' : 'Value'}</TableHead>
                    <TableHead>{isRTL ? 'الاستخدام' : 'Usage'}</TableHead>
                    <TableHead>{isRTL ? 'الصلاحية' : 'Validity'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <span className="font-mono font-bold text-primary">{coupon.code}</span>
                        {!coupon.is_global && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isRTL ? 'خاص بدورة محددة' : 'Course-specific'}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{getTypeBadge(coupon.type)}</TableCell>
                      <TableCell className="font-semibold">
                        {coupon.type === 'percentage_discount' ? `${coupon.value}%` : `${coupon.value} SAR`}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{coupon.used_count}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-sm text-muted-foreground">{coupon.max_usage}</span>
                        </div>
                        <div className="w-16 h-1.5 rounded-full bg-muted mt-1">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min((coupon.used_count / coupon.max_usage) * 100, 100)}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{format(new Date(coupon.start_date), 'MMM dd')}</div>
                        <div>→ {format(new Date(coupon.expiry_date), 'MMM dd, yyyy')}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(coupon.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => openEdit(coupon)}>
                              <Pencil className="w-4 h-4 me-2" />{isRTL ? 'تعديل' : 'Edit'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setViewUsage(coupon.id)}>
                              <Eye className="w-4 h-4 me-2" />{isRTL ? 'سجل الاستخدام' : 'Usage Log'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateCoupon(coupon)}>
                              <Copy className="w-4 h-4 me-2" />{isRTL ? 'تكرار' : 'Duplicate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: coupon.id, status: coupon.status })}>
                              <ToggleLeft className="w-4 h-4 me-2" />
                              {coupon.status === 'active' ? (isRTL ? 'إيقاف' : 'Deactivate') : (isRTL ? 'تفعيل' : 'Activate')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteConfirm(coupon.id)} className="text-destructive">
                              <Trash2 className="w-4 h-4 me-2" />{isRTL ? 'حذف' : 'Delete'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isRTL ? 'لا توجد كوبونات' : 'No coupons found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </>
        )}

        {activeTab === 'series' && (
          <div className="space-y-4">
            <Card id="dynamic-series-form">
              <CardHeader>
                <CardTitle>{isRTL ? 'إنشاء سلسلة كودات ديناميكية' : 'Create Dynamic Coupon Series'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'Prefix' : 'Prefix'} *</Label>
                    <Input
                      value={seriesForm.prefix}
                      onChange={(e) => setSeriesForm((p) => ({ ...p, prefix: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                      placeholder="OMR"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'نوع الخصم' : 'Discount Type'} *</Label>
                    <Select value={seriesForm.discount_type} onValueChange={(v) => setSeriesForm((p) => ({ ...p, discount_type: v as 'percentage' | 'fixed' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">{isRTL ? 'نسبة %' : 'Percentage %'}</SelectItem>
                        <SelectItem value="fixed">{isRTL ? 'مبلغ ثابت' : 'Fixed Amount'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'من' : 'From'} *</Label>
                    <Input type="number" value={seriesForm.range_from} onChange={(e) => setSeriesForm((p) => ({ ...p, range_from: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'إلى' : 'To'} *</Label>
                    <Input type="number" value={seriesForm.range_to} onChange={(e) => setSeriesForm((p) => ({ ...p, range_to: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'قيمة الخصم' : 'Discount Value'} *</Label>
                    <Input type="number" value={seriesForm.discount_value} onChange={(e) => setSeriesForm((p) => ({ ...p, discount_value: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'استخدام/كود' : 'Uses/Code'} *</Label>
                    <Input type="number" min={1} value={seriesForm.max_uses_per_code} onChange={(e) => setSeriesForm((p) => ({ ...p, max_uses_per_code: parseInt(e.target.value) || 1 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'تاريخ الانتهاء (اختياري)' : 'Expiry Date (optional)'}</Label>
                    <Input type="datetime-local" value={seriesForm.expiry_date} onChange={(e) => setSeriesForm((p) => ({ ...p, expiry_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'النطاق' : 'Scope'}</Label>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch checked={seriesForm.is_global} onCheckedChange={(checked) => setSeriesForm((p) => ({ ...p, is_global: checked, course_id: checked ? '' : p.course_id }))} />
                      <span className="text-sm text-muted-foreground">{isRTL ? 'كل الكورسات' : 'All courses'}</span>
                    </div>
                  </div>
                  {!seriesForm.is_global && (
                    <div className="space-y-2">
                      <Label>{isRTL ? 'الكورس' : 'Course'}</Label>
                      <Select value={seriesForm.course_id} onValueChange={(v) => setSeriesForm((p) => ({ ...p, course_id: v }))}>
                        <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر كورس' : 'Select course'} /></SelectTrigger>
                        <SelectContent>
                          {courses?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{isRTL ? c.title_ar || c.title : c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'وصف (اختياري)' : 'Description (optional)'}</Label>
                  <Textarea value={seriesForm.description} onChange={(e) => setSeriesForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-mono">{`${seriesForm.prefix || 'PREFIX'}${seriesForm.range_from} ← ${seriesForm.prefix || 'PREFIX'}${seriesForm.range_to}`}</p>
                  <p className="text-muted-foreground mt-1">
                    {isRTL ? 'عدد الأكواد:' : 'Total codes:'} {Math.max(seriesForm.range_to - seriesForm.range_from + 1, 0)}
                  </p>
                </div>
                <Button onClick={() => createSeriesMutation.mutate()} disabled={createSeriesMutation.isPending}>
                  {isRTL ? 'إنشاء السلسلة' : 'Create Series'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={seriesSearch} onChange={(e) => setSeriesSearch(e.target.value)} className="ps-10" placeholder={isRTL ? 'بحث في السلاسل...' : 'Search series...'} />
                </div>
              </CardContent>
            </Card>

            {seriesLoading ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{isRTL ? 'جار التحميل...' : 'Loading...'}</CardContent></Card>
            ) : filteredSeries.map((series) => {
              const totalCodes = Math.max(series.range_to - series.range_from + 1, 0);
              const usedDistinct = seriesUsageCodesMap?.get(series.id)?.size || 0;
              const remaining = Math.max(totalCodes - usedDistinct, 0);
              const isExpanded = expandedSeriesId === series.id;
              return (
                <Card key={series.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="font-mono font-semibold">{`${series.prefix}${series.range_from} — ${series.prefix}${series.range_to}`}</p>
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? 'خصم' : 'Discount'} {series.discount_type === 'percentage' ? `${series.discount_value}%` : `${series.discount_value} SAR`} ·
                          {' '}{isRTL ? 'استخدام' : 'Uses'} {series.max_uses_per_code}/{isRTL ? 'كود' : 'code'} · {totalCodes} {isRTL ? 'كود' : 'codes'}
                        </p>
                      </div>
                      {getSeriesStatusBadge(series.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isRTL ? 'استُخدم:' : 'Used:'} {usedDistinct} · {isRTL ? 'المتبقي:' : 'Remaining:'} {remaining}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setExpandedSeriesId(isExpanded ? null : series.id)}>
                        <ChevronDown className="w-4 h-4 me-1" />{isRTL ? 'عرض الاستخدامات' : 'View Usage'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleSeriesStatusMutation.mutate(series)}>
                        {series.status === 'active' ? <Pause className="w-4 h-4 me-1" /> : <Play className="w-4 h-4 me-1" />}
                        {series.status === 'active' ? (isRTL ? 'إيقاف' : 'Pause') : (isRTL ? 'تفعيل' : 'Activate')}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteSeriesMutation.mutate(series.id)}>
                        <Trash2 className="w-4 h-4 me-1" />{isRTL ? 'حذف' : 'Delete'}
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="border rounded-lg p-3 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                          <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input className="ps-10" value={seriesUsageSearch} onChange={(e) => setSeriesUsageSearch(e.target.value)} placeholder={isRTL ? 'بحث بالكود أو المستخدم...' : 'Search by code or user...'} />
                          </div>
                          <Button variant="outline" size="sm" onClick={exportSeriesUsageCsv}>
                            <Download className="w-4 h-4 me-1" />CSV
                          </Button>
                        </div>
                        {expandedSeriesUsageLoading ? (
                          <div className="py-6 text-center text-muted-foreground">{isRTL ? 'جار تحميل الاستخدامات...' : 'Loading usage...'}</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{isRTL ? 'الكود' : 'Code'}</TableHead>
                                <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                                <TableHead>{isRTL ? 'الكورس' : 'Course'}</TableHead>
                                <TableHead>{isRTL ? 'المبالغ' : 'Amounts'}</TableHead>
                                <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredExpandedUsage.map((row: any) => (
                                <TableRow key={row.id}>
                                  <TableCell className="font-mono">{row.code_used}</TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="text-sm font-medium">{row._profile?.full_name || (isRTL ? 'غير معروف' : 'Unknown')}</p>
                                      <p className="text-xs text-muted-foreground" dir="ltr">{row._email || '—'}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{row._course ? (isRTL ? row._course.title_ar || row._course.title : row._course.title) : '—'}</TableCell>
                                  <TableCell className="text-xs">
                                    <div>{isRTL ? 'الأصلي' : 'Original'}: {Number(row.original_amount).toFixed(2)} SAR</div>
                                    <div>{isRTL ? 'الخصم' : 'Discount'}: {Number(row.discount_amount).toFixed(2)} SAR</div>
                                    <div>{isRTL ? 'النهائي' : 'Final'}: {Number(row.final_amount).toFixed(2)} SAR</div>
                                  </TableCell>
                                  <TableCell className="text-xs">{format(new Date(row.used_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                                </TableRow>
                              ))}
                              {filteredExpandedUsage.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                    {isRTL ? 'لا يوجد استخدامات' : 'No usage records'}
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Dialog */}
        {activeTab === 'coupons' && (
        <>
        <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingCoupon(null); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? (isRTL ? 'تعديل الكوبون' : 'Edit Coupon') : (isRTL ? 'كوبون جديد' : 'New Coupon')}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل تفاصيل الكوبون' : 'Enter coupon details'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'رمز الكوبون' : 'Coupon Code'} *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    placeholder="SUMMER25"
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'النوع' : 'Type'} *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage_discount">{isRTL ? 'نسبة خصم (%)' : 'Percentage (%)'}</SelectItem>
                      <SelectItem value="fixed_amount_discount">{isRTL ? 'مبلغ ثابت' : 'Fixed Amount'}</SelectItem>
                      <SelectItem value="promotion">{isRTL ? 'عرض ترويجي' : 'Promotion'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{formData.type === 'percentage_discount' ? (isRTL ? 'نسبة الخصم (%)' : 'Discount (%)') : (isRTL ? 'المبلغ (SAR)' : 'Amount (SAR)')} *</Label>
                  <Input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={formData.type === 'percentage_discount' ? 100 : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الحد الأدنى للطلب' : 'Min. Amount (SAR)'}</Label>
                  <Input
                    type="number"
                    value={formData.minimum_amount}
                    onChange={(e) => setFormData({ ...formData, minimum_amount: parseFloat(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'تاريخ البداية' : 'Start Date'} *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'} *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'الحد الأقصى للاستخدام' : 'Max Usage'} *</Label>
                  <Input
                    type="number"
                    value={formData.max_usage}
                    onChange={(e) => setFormData({ ...formData, max_usage: parseInt(e.target.value) || 1 })}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الحد لكل مستخدم' : 'Max Per User'}</Label>
                  <Input
                    type="number"
                    value={formData.max_per_user}
                    onChange={(e) => setFormData({ ...formData, max_per_user: parseInt(e.target.value) || 1 })}
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? 'الوصف (EN)' : 'Description (EN)'}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? 'الوصف (AR)' : 'Description (AR)'}</Label>
                <Textarea
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  rows={2}
                  dir="rtl"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    id="is_global"
                    checked={formData.is_global}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_global: checked, course_id: checked ? '' : formData.course_id })}
                  />
                  <Label htmlFor="is_global" className="cursor-pointer">
                    {isRTL ? 'كوبون عام (جميع الدورات)' : 'Global (all courses)'}
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="is_stackable"
                    checked={formData.is_stackable}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_stackable: checked })}
                  />
                  <Label htmlFor="is_stackable" className="cursor-pointer">
                    {isRTL ? 'قابل للتكديس' : 'Stackable'}
                  </Label>
                </div>
              </div>

              {!formData.is_global && (
                <div className="space-y-2">
                  <Label>{isRTL ? 'الدورة المحددة' : 'Specific Course'}</Label>
                  <Select value={formData.course_id} onValueChange={(v) => setFormData({ ...formData, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر دورة' : 'Select course'} /></SelectTrigger>
                    <SelectContent>
                      {courses?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {isRTL ? c.title_ar || c.title : c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsFormOpen(false); setEditingCoupon(null); }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin me-2" />
                )}
                {editingCoupon ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إنشاء' : 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'هل تريد حذف هذا الكوبون؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this coupon? This action cannot be undone.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>
                {isRTL ? 'حذف' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Usage Log Dialog */}
        <Dialog open={!!viewUsage} onOpenChange={() => setViewUsage(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'سجل الاستخدام' : 'Usage Log'}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'تفاصيل المستخدمين الذين استخدموا هذا الكوبون' : 'Details of users who used this coupon'}
              </DialogDescription>
            </DialogHeader>
            {usageLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                    <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'النتيجة' : 'Result'}</TableHead>
                    <TableHead>{isRTL ? 'الخصم' : 'Discount'}</TableHead>
                    <TableHead>{isRTL ? 'المبلغ النهائي' : 'Final'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageLogs?.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="min-w-[120px]">
                          <p className="text-sm font-medium truncate">{log._profile?.full_name || (isRTL ? 'غير معروف' : 'Unknown')}</p>
                          {log._email && <p className="text-xs text-muted-foreground truncate">{log._email}</p>}
                          {log._profile?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{log._profile.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm truncate block max-w-[140px]">
                          {log._course
                            ? (isRTL ? log._course.title_ar || log._course.title : log._course.title)
                            : <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.applied_at), 'MMM dd, HH:mm')}</TableCell>
                      <TableCell>
                        {log.result === 'success'
                          ? <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">{isRTL ? 'نجح' : 'OK'}</Badge>
                          : <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">{isRTL ? 'فشل' : 'Fail'}</Badge>
                        }
                        {log.failure_reason && <p className="text-xs text-destructive mt-0.5 max-w-[100px] truncate">{log.failure_reason}</p>}
                      </TableCell>
                      <TableCell>{Number(log.discount_amount).toFixed(0)} SAR</TableCell>
                      <TableCell>{Number(log.final_amount).toFixed(0)} SAR</TableCell>
                    </TableRow>
                  ))}
                  {(!usageLogs || usageLogs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        {isRTL ? 'لا يوجد سجل استخدام' : 'No usage records'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
        </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCoupons;
