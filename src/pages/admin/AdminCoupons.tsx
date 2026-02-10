import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
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
  AlertTriangle, CheckCircle, XCircle, Clock, Percent, Hash,
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
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewUsage, setViewUsage] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultForm);

  // Fetch coupons
  const { data: coupons, isLoading } = useQuery({
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
  const { data: courses } = useQuery({
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

  // Fetch usage logs for a coupon
  const { data: usageLogs } = useQuery({
    queryKey: ['coupon-usage', viewUsage],
    enabled: !!viewUsage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupon_usage_logs')
        .select('*')
        .eq('coupon_id', viewUsage!)
        .order('applied_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Create coupon
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('coupons').insert({
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
  const updateMutation = useMutation({
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
  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('coupons').update({ status: newStatus }).eq('id', id);
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
  const deleteMutation = useMutation({
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
          <Button onClick={() => { setEditingCoupon(null); setFormData(defaultForm); setIsFormOpen(true); }}>
            <Plus className="w-4 h-4 me-2" />
            {isRTL ? 'كوبون جديد' : 'New Coupon'}
          </Button>
        </div>

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

        {/* Create/Edit Dialog */}
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
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'سجل الاستخدام' : 'Usage Log'}</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead>{isRTL ? 'النتيجة' : 'Result'}</TableHead>
                  <TableHead>{isRTL ? 'الخصم' : 'Discount'}</TableHead>
                  <TableHead>{isRTL ? 'المبلغ النهائي' : 'Final'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageLogs?.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.applied_at), 'MMM dd, HH:mm')}</TableCell>
                    <TableCell>
                      {log.result === 'success'
                        ? <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">✓</Badge>
                        : <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">✗</Badge>
                      }
                    </TableCell>
                    <TableCell>{Number(log.discount_amount).toFixed(0)} SAR</TableCell>
                    <TableCell>{Number(log.final_amount).toFixed(0)} SAR</TableCell>
                  </TableRow>
                ))}
                {(!usageLogs || usageLogs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      {isRTL ? 'لا يوجد سجل استخدام' : 'No usage records'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminCoupons;
