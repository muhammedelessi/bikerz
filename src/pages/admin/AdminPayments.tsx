import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Search, MoreHorizontal, DollarSign, Clock, CheckCircle, XCircle,
  Eye, Check, X, Download, CreditCard, Banknote, User, MapPin,
  Phone, Mail, AlertTriangle, FileText, Shield,
} from 'lucide-react';
import { format } from 'date-fns';

interface UnifiedPayment {
  id: string;
  user_id: string;
  course_id: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  source: 'manual' | 'tap';
  // manual fields
  payment_method?: string;
  reference_number?: string | null;
  notes?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  // tap fields
  charge_id?: string | null;
  card_brand?: string | null;
  card_last_four?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  error_message?: string | null;
  webhook_verified?: boolean | null;
  metadata?: Record<string, unknown> | null;
  tap_response?: Record<string, unknown> | null;
  device_info?: string | null;
  // joined
  profile?: {
    full_name: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    postal_code: string | null;
    profile_complete: boolean;
  } | null;
  course?: { title: string | null; title_ar: string | null; price: number | null; discount_percentage: number | null } | null;
}

const normalizeStatus = (status: string, source: 'manual' | 'tap'): string => {
  if (source === 'tap') {
    if (status === 'succeeded' || status === 'captured') return 'approved';
    if (status === 'failed' || status === 'cancelled' || status === 'expired' || status === 'declined') return 'rejected';
    if (status === 'pending' || status === 'processing' || status === 'initiated') return 'pending';
  }
  return status;
};

const AdminPayments = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: payments, isLoading } = useQuery({
    queryKey: ['admin-payments-unified'],
    queryFn: async () => {
      const [manualRes, tapRes] = await Promise.all([
        supabase.from('manual_payments').select('*').order('created_at', { ascending: false }),
        supabase.from('tap_charges').select('*').order('created_at', { ascending: false }),
      ]);

      const manualData: UnifiedPayment[] = (manualRes.data || []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        course_id: p.course_id,
        amount: Number(p.amount),
        currency: p.currency || 'SAR',
        status: p.status || 'pending',
        created_at: p.created_at,
        source: 'manual' as const,
        payment_method: p.payment_method,
        reference_number: p.reference_number,
        notes: p.notes,
        approved_by: p.approved_by,
        approved_at: p.approved_at,
      }));

      const tapData: UnifiedPayment[] = (tapRes.data || []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        course_id: p.course_id,
        amount: Number(p.amount),
        currency: p.currency || 'SAR',
        status: p.status,
        created_at: p.created_at,
        source: 'tap' as const,
        charge_id: p.charge_id,
        card_brand: p.card_brand,
        card_last_four: p.card_last_four,
        customer_name: p.customer_name,
        customer_email: p.customer_email,
        customer_phone: p.customer_phone,
        error_message: p.error_message,
        webhook_verified: p.webhook_verified,
        metadata: p.metadata as Record<string, unknown> | null,
        tap_response: p.tap_response as Record<string, unknown> | null,
        payment_method: p.payment_method || 'card',
        device_info: (p as any).device_info || null,
      }));

      const all = [...manualData, ...tapData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const userIds = [...new Set(all.map((p) => p.user_id))];
      const courseIds = [...new Set(all.filter((p) => p.course_id).map((p) => p.course_id!))];

      const [profilesRes, coursesRes] = await Promise.all([
        userIds.length > 0 ? supabase.from('profiles').select('user_id, full_name, phone, city, country, postal_code, profile_complete').in('user_id', userIds) : { data: [] },
        courseIds.length > 0 ? supabase.from('courses').select('id, title, title_ar, price, discount_percentage').in('id', courseIds) : { data: [] },
      ]);

      return all.map((p) => ({
        ...p,
        profile: profilesRes.data?.find((pr: any) => pr.user_id === p.user_id) || null,
        course: coursesRes.data?.find((c: any) => c.id === p.course_id) || null,
      }));
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, status, notes }: { paymentId: string; status: string; notes?: string }) => {
      if (!selectedPayment || selectedPayment.source !== 'manual') return;
      const updateData: any = { status, notes: notes || null };
      if (status === 'approved') {
        updateData.approved_by = user?.id;
        updateData.approved_at = new Date().toISOString();
      }
      const { error } = await supabase.from('manual_payments').update(updateData).eq('id', paymentId);
      if (error) throw error;

      if (status === 'approved' && selectedPayment?.course_id) {
        const { error: enrollError } = await supabase
          .from('course_enrollments')
          .insert({ user_id: selectedPayment.user_id, course_id: selectedPayment.course_id });
        if (enrollError && !enrollError.message.includes('duplicate')) throw enrollError;
      }

      await logAction({
        action: status === 'approved' ? 'payment_approved' : 'payment_rejected',
        entityType: 'payment',
        entityId: paymentId,
        oldData: { status: selectedPayment?.status },
        newData: { status, notes, amount: selectedPayment?.amount },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments-unified'] });
      setSelectedPayment(null);
      setAdminNotes('');
      toast({
        title: isRTL ? 'تم التحديث' : 'Updated',
        description: isRTL ? 'تم تحديث حالة الدفع بنجاح' : 'Payment status updated successfully',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحديث الدفع' : 'Failed to update payment',
      });
    },
  });

  const filteredPayments = payments?.filter((payment) => {
    const displayName = payment.source === 'tap'
      ? payment.customer_name || payment.profile?.full_name
      : payment.profile?.full_name;
    const matchesSearch =
      displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.charge_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.customer_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const normalized = normalizeStatus(payment.status, payment.source);
    const matchesStatus = statusFilter === 'all' || normalized === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const approvedPayments = payments?.filter((p) => normalizeStatus(p.status, p.source) === 'approved') || [];
  const pendingPayments = payments?.filter((p) => normalizeStatus(p.status, p.source) === 'pending') || [];
  const rejectedPayments = payments?.filter((p) => normalizeStatus(p.status, p.source) === 'rejected') || [];
  const totalRevenue = approvedPayments.reduce((sum, p) => sum + p.amount, 0);

  const stats = [
    {
      titleEn: 'Total Revenue', titleAr: 'إجمالي الإيرادات',
      value: `SAR ${totalRevenue.toFixed(2)}`,
      icon: DollarSign, color: 'text-green-500', bgColor: 'bg-green-500/10',
    },
    {
      titleEn: 'Pending', titleAr: 'المعلقة',
      value: pendingPayments.length,
      icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10',
    },
    {
      titleEn: 'Approved', titleAr: 'المعتمدة',
      value: approvedPayments.length,
      icon: CheckCircle, color: 'text-blue-500', bgColor: 'bg-blue-500/10',
    },
    {
      titleEn: 'Rejected', titleAr: 'المرفوضة',
      value: rejectedPayments.length,
      icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10',
    },
  ];

  const getStatusBadge = (status: string, source: 'manual' | 'tap') => {
    const norm = normalizeStatus(status, source);
    const original = source === 'tap' && norm !== status ? ` (${status})` : '';
    switch (norm) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <Clock className="w-3 h-3 me-1" />{isRTL ? 'معلق' : 'Pending'}{original}
        </Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="w-3 h-3 me-1" />{isRTL ? 'معتمد' : 'Approved'}{original}
        </Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
          <XCircle className="w-3 h-3 me-1" />{isRTL ? 'مرفوض' : 'Rejected'}{original}
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSourceBadge = (source: 'manual' | 'tap') => {
    if (source === 'tap') {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
        <CreditCard className="w-3 h-3 me-1" />{isRTL ? 'بطاقة' : 'Card'}
      </Badge>;
    }
    return <Badge variant="outline" className="bg-muted text-muted-foreground border-muted">
      <Banknote className="w-3 h-3 me-1" />{isRTL ? 'يدوي' : 'Manual'}
    </Badge>;
  };

  const getPaymentMethodLabel = (payment: UnifiedPayment) => {
    if (payment.source === 'manual') return payment.payment_method || '-';
    const method = payment.payment_method?.toLowerCase() || '';
    if (method.includes('apple')) return 'Apple Pay';
    if (method.includes('google')) return 'Google Pay';
    if (payment.card_brand) {
      return `${payment.card_brand} •••• ${payment.card_last_four || ''}`;
    }
    return method || 'Card';
  };

  // Extract price breakdown from metadata/tap_response
  const getPriceBreakdown = (payment: UnifiedPayment) => {
    const meta = payment.metadata || {};
    const originalAmount = (meta.original_amount as number) || (meta.price_before_tax as number) || null;
    const couponDiscount = (meta.coupon_discount as number) || 0;
    const couponCode = (meta.coupon_code as string) || null;
    const vatAmount = (meta.vat_amount as number) || null;
    const courseDiscount = (meta.course_discount as number) || 0;

    // Calculate VAT: amount includes 15% VAT, so pre-VAT = amount / 1.15
    const amountBeforeVAT = vatAmount !== null ? payment.amount - vatAmount : Math.round((payment.amount / 1.15) * 100) / 100;
    const calculatedVAT = vatAmount !== null ? vatAmount : Math.round((payment.amount - amountBeforeVAT) * 100) / 100;

    return { originalAmount, couponDiscount, couponCode, vatAmount: calculatedVAT, amountBeforeVAT, courseDiscount };
  };

  // Human-readable Tap error code translations
  const tapErrorTranslations: Record<string, { en: string; ar: string }> = {
    '101': { en: 'Insufficient funds', ar: 'رصيد غير كافٍ' },
    '102': { en: 'Card expired', ar: 'البطاقة منتهية الصلاحية' },
    '103': { en: 'Card declined', ar: 'البطاقة مرفوضة' },
    '104': { en: 'Invalid card details', ar: 'خطأ في بيانات البطاقة' },
    '105': { en: 'Transaction limit exceeded', ar: 'تجاوز حد المعاملات' },
    '106': { en: 'Card not supported', ar: 'البطاقة غير مدعومة' },
    '107': { en: 'Card restricted', ar: 'البطاقة مقيدة' },
    '108': { en: 'Authentication failed', ar: 'فشل التحقق من الهوية' },
    '109': { en: '3D Secure authentication failed', ar: 'فشل التحقق الأمني ثلاثي الأبعاد' },
    '110': { en: 'Transaction not permitted', ar: 'العملية غير مسموح بها' },
    '200': { en: 'Communication error with bank', ar: 'خطأ في الاتصال بالبنك' },
    '301': { en: 'Transaction timed out', ar: 'انتهت مهلة العملية' },
    '302': { en: 'Transaction cancelled by customer', ar: 'تم إلغاء العملية من قبل العميل' },
    '303': { en: 'Duplicate transaction', ar: 'عملية مكررة' },
    '401': { en: 'Authentication required', ar: 'مطلوب التحقق من الهوية' },
    '501': { en: 'Gateway error', ar: 'خطأ في بوابة الدفع' },
    '502': { en: 'Gateway timeout', ar: 'انتهت مهلة بوابة الدفع' },
    '507': { en: 'Card declined by issuing bank (Card Issuer)', ar: 'تم رفض البطاقة من قبل البنك المُصدر' },
  };

  const getTranslatedErrorReason = (code: string | null): string | null => {
    if (!code) return null;
    const translation = tapErrorTranslations[code];
    if (translation) return isRTL ? translation.ar : translation.en;
    return null;
  };

  // Extract failure details from tap_response
  const getFailureDetails = (payment: UnifiedPayment) => {
    if (normalizeStatus(payment.status, payment.source) !== 'rejected') return null;
    const resp = payment.tap_response || {};
    const response = resp.response as Record<string, unknown> | undefined;
    const gateway = resp.gateway as Record<string, unknown> | undefined;
    const code = (response?.code as string) || (gateway?.response?.toString()) || null;
    const translatedReason = getTranslatedErrorReason(code);
    // Full decline reason from Tap API response.message
    const tapDeclineMessage = (response?.message as string) || null;
    return {
      reason: translatedReason || payment.error_message || tapDeclineMessage || (isRTL ? 'فشل الدفع' : 'Payment failed'),
      code,
      gatewayResponse: (gateway?.response as string) || null,
      translatedReason,
      tapDeclineMessage,
    };
  };

  // CSV Export
  const exportToCSV = () => {
    if (!filteredPayments?.length) return;
    const headers = [
      'Date', 'Customer Name', 'Email', 'Phone', 'City', 'Country',
      'Course', 'Amount', 'Currency', 'Status', 'Payment Method',
      'Transaction ID', 'Source', 'Error Message', 'Profile Complete',
    ];
    const rows = filteredPayments.map((p) => {
      const displayName = p.source === 'tap' ? p.customer_name || p.profile?.full_name : p.profile?.full_name;
      return [
        format(new Date(p.created_at), 'yyyy-MM-dd HH:mm:ss'),
        displayName || '',
        p.customer_email || '',
        p.customer_phone || p.profile?.phone || '',
        p.profile?.city || '',
        p.profile?.country || '',
        p.course?.title || '',
        p.amount.toFixed(2),
        p.currency,
        normalizeStatus(p.status, p.source),
        getPaymentMethodLabel(p),
        p.charge_id || p.reference_number || '',
        p.source,
        p.error_message || '',
        p.profile?.profile_complete ? 'Yes' : 'No',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const DetailRow = ({ label, value, icon: Icon, className = '' }: { label: string; value: React.ReactNode; icon?: any; className?: string }) => (
    <div className={`flex items-start gap-2 ${className}`}>
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-all">{value || '-'}</div>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'إدارة المدفوعات' : 'Payment Management'}
            </h1>
            <p className="text-muted-foreground">
              {isRTL ? 'جميع المدفوعات — البطاقات واليدوية' : 'All payments — card & manual'}
            </p>
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={!filteredPayments?.length}>
            <Download className="w-4 h-4 me-2" />
            {isRTL ? 'تصدير CSV' : 'Export CSV'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? stat.titleAr : stat.titleEn}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
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
                  placeholder={isRTL ? 'البحث بالاسم أو البريد أو رقم المرجع...' : 'Search by name, email, or reference...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
                <TabsList>
                  <TabsTrigger value="all">{isRTL ? 'الكل' : 'All'}</TabsTrigger>
                  <TabsTrigger value="pending">{isRTL ? 'معلق' : 'Pending'}</TabsTrigger>
                  <TabsTrigger value="approved">{isRTL ? 'معتمد' : 'Approved'}</TabsTrigger>
                  <TabsTrigger value="rejected">{isRTL ? 'مرفوض' : 'Rejected'}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'سجل المدفوعات' : 'Payment Records'}</CardTitle>
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
                    <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                    <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                    <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                    <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{isRTL ? 'طريقة الدفع' : 'Method'}</TableHead>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments?.map((payment) => {
                    const displayName = payment.source === 'tap'
                      ? payment.customer_name || payment.profile?.full_name || 'Unknown'
                      : payment.profile?.full_name || 'Unknown';
                    const isFailed = normalizeStatus(payment.status, payment.source) === 'rejected';
                    return (
                      <TableRow
                        key={`${payment.source}-${payment.id}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => { setSelectedPayment(payment); setAdminNotes(''); }}
                      >
                        <TableCell>
                          <div>
                            <span className="font-medium">{displayName}</span>
                            {payment.customer_email && (
                              <p className="text-xs text-muted-foreground">{payment.customer_email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isRTL
                            ? payment.course?.title_ar || payment.course?.title || 'N/A'
                            : payment.course?.title || 'N/A'}
                        </TableCell>
                        <TableCell>{payment.amount.toFixed(2)} {payment.currency}</TableCell>
                        <TableCell>{getSourceBadge(payment.source)}</TableCell>
                        <TableCell className="capitalize">{getPaymentMethodLabel(payment)}</TableCell>
                        <TableCell>{format(new Date(payment.created_at), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(payment.status, payment.source)}
                            {isFailed && payment.error_message && (
                              <p className="text-xs text-red-500 max-w-[150px] truncate" title={payment.error_message}>
                                {payment.error_message}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => { setSelectedPayment(payment); setAdminNotes(''); }}>
                                <Eye className="w-4 h-4 me-2" />
                                {isRTL ? 'عرض التفاصيل' : 'View Details'}
                              </DropdownMenuItem>
                              {payment.source === 'manual' && payment.status === 'pending' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => { setSelectedPayment(payment); setAdminNotes(''); }}
                                    className="text-green-600"
                                  >
                                    <Check className="w-4 h-4 me-2" />{isRTL ? 'اعتماد' : 'Approve'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => { setSelectedPayment(payment); setAdminNotes(''); }}
                                    className="text-destructive"
                                  >
                                    <X className="w-4 h-4 me-2" />{isRTL ? 'رفض' : 'Reject'}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredPayments?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {isRTL ? 'لا توجد مدفوعات' : 'No payments found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog — expanded */}
        <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-2xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {isRTL ? 'تفاصيل الطلب' : 'Order Details'}
              </DialogTitle>
              <DialogDescription>
                {selectedPayment?.charge_id || selectedPayment?.reference_number || selectedPayment?.id}
              </DialogDescription>
            </DialogHeader>

            {selectedPayment && (
              <ScrollArea className="max-h-[calc(90vh-100px)] px-6 pb-6">
                <div className="space-y-5">
                  {/* Status Banner */}
                  {(() => {
                    const failureDetails = getFailureDetails(selectedPayment);
                    if (failureDetails) {
                      return (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2">
                          <div className="flex items-center gap-2 text-red-500 font-semibold">
                            <AlertTriangle className="w-5 h-5" />
                            {isRTL ? 'فشل الدفع' : 'Payment Failed'}
                          </div>
                          <p className="text-sm text-red-400 font-medium">{failureDetails.reason}</p>
                          {failureDetails.code && (
                            <p className="text-xs text-red-400/70">
                              {isRTL ? 'رمز الخطأ' : 'Error Code'}: <span className="font-mono">{failureDetails.code}</span>
                            </p>
                          )}
                          {failureDetails.tapDeclineMessage && failureDetails.tapDeclineMessage !== failureDetails.reason && (
                            <p className="text-xs text-red-400/70">
                              {isRTL ? 'تفاصيل الرفض' : 'Decline Details'}: {failureDetails.tapDeclineMessage}
                            </p>
                          )}
                          {failureDetails.gatewayResponse && (
                            <p className="text-xs text-red-400/70">
                              {isRTL ? 'استجابة البوابة' : 'Gateway Response'}: {failureDetails.gatewayResponse}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Customer Info Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {isRTL ? 'معلومات العميل' : 'Customer Information'}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
                      <DetailRow
                        icon={User}
                        label={isRTL ? 'الاسم الكامل' : 'Full Name'}
                        value={selectedPayment.customer_name || selectedPayment.profile?.full_name || '-'}
                      />
                      <DetailRow
                        icon={Mail}
                        label={isRTL ? 'البريد الإلكتروني' : 'Email'}
                        value={selectedPayment.customer_email || '-'}
                      />
                      <DetailRow
                        icon={Phone}
                        label={isRTL ? 'الهاتف' : 'Phone'}
                        value={selectedPayment.customer_phone || selectedPayment.profile?.phone || '-'}
                      />
                      <DetailRow
                        icon={MapPin}
                        label={isRTL ? 'المدينة' : 'City'}
                        value={selectedPayment.profile?.city || '-'}
                      />
                      <DetailRow
                        icon={MapPin}
                        label={isRTL ? 'الدولة' : 'Country'}
                        value={selectedPayment.profile?.country || '-'}
                      />
                      <DetailRow
                        icon={Shield}
                        label={isRTL ? 'حالة الملف الشخصي' : 'Profile Status'}
                        value={
                          selectedPayment.profile?.profile_complete
                            ? <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">{isRTL ? 'مكتمل' : 'Complete'}</Badge>
                            : <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">{isRTL ? 'غير مكتمل' : 'Incomplete'}</Badge>
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Payment Info Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      {isRTL ? 'معلومات الدفع' : 'Payment Information'}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
                      <DetailRow
                        label={isRTL ? 'الدورة' : 'Course'}
                        value={isRTL
                          ? selectedPayment.course?.title_ar || selectedPayment.course?.title || '-'
                          : selectedPayment.course?.title || '-'
                        }
                      />
                      <DetailRow
                        label={isRTL ? 'حالة الدفع' : 'Payment Status'}
                        value={getStatusBadge(selectedPayment.status, selectedPayment.source)}
                      />

                      {/* Price breakdown */}
                      {(() => {
                        const breakdown = getPriceBreakdown(selectedPayment);
                        return (
                          <>
                            {breakdown.originalAmount && (
                              <DetailRow
                                label={isRTL ? 'السعر الأصلي' : 'Original Price'}
                                value={`${breakdown.originalAmount.toFixed(2)} ${selectedPayment.currency}`}
                              />
                            )}
                            {breakdown.courseDiscount > 0 && (
                              <DetailRow
                                label={isRTL ? 'خصم الدورة' : 'Course Discount'}
                                value={<span className="text-green-500">-{breakdown.courseDiscount.toFixed(2)} {selectedPayment.currency}</span>}
                              />
                            )}
                            {breakdown.couponDiscount > 0 && (
                              <DetailRow
                                label={isRTL ? 'خصم الكوبون' : 'Coupon Discount'}
                                value={
                                  <span className="text-green-500">
                                    -{breakdown.couponDiscount.toFixed(2)} {selectedPayment.currency}
                                    {breakdown.couponCode && <span className="text-muted-foreground ms-1">({breakdown.couponCode})</span>}
                                  </span>
                                }
                              />
                            )}
                            <DetailRow
                              label={isRTL ? 'المبلغ قبل الضريبة' : 'Amount Before VAT'}
                              value={`${breakdown.amountBeforeVAT.toFixed(2)} ${selectedPayment.currency}`}
                            />
                            <DetailRow
                              label={isRTL ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}
                              value={`${breakdown.vatAmount.toFixed(2)} ${selectedPayment.currency}`}
                            />
                          </>
                        );
                      })()}

                      <DetailRow
                        label={isRTL ? 'المبلغ المحصل' : 'Total Charged'}
                        value={<span className="text-base font-bold">{selectedPayment.amount.toFixed(2)} {selectedPayment.currency}</span>}
                      />
                      <DetailRow
                        label={isRTL ? 'العملة' : 'Currency'}
                        value={selectedPayment.currency}
                      />
                      <DetailRow
                        label={isRTL ? 'طريقة الدفع' : 'Payment Method'}
                        value={getPaymentMethodLabel(selectedPayment)}
                      />
                      <DetailRow
                        label={isRTL ? 'النوع' : 'Source'}
                        value={getSourceBadge(selectedPayment.source)}
                      />

                      {selectedPayment.source === 'tap' && (
                        <>
                          <DetailRow
                            label={isRTL ? 'رقم العملية (Tap)' : 'Transaction ID (Tap)'}
                            value={<span className="font-mono text-xs">{selectedPayment.charge_id || '-'}</span>}
                          />
                          <DetailRow
                            label={isRTL ? 'تم التحقق من الويب هوك' : 'Webhook Verified'}
                            value={
                              selectedPayment.webhook_verified
                                ? <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">✓ {isRTL ? 'نعم' : 'Yes'}</Badge>
                                : <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">{isRTL ? 'لا' : 'No'}</Badge>
                            }
                          />
                          {selectedPayment.device_info && (
                            <DetailRow
                              label={isRTL ? 'جهاز المستخدم' : 'User Device'}
                              value={<span className="text-xs font-mono">{selectedPayment.device_info}</span>}
                            />
                          )}
                        </>
                      )}

                      {selectedPayment.source === 'manual' && selectedPayment.reference_number && (
                        <DetailRow
                          label={isRTL ? 'رقم المرجع' : 'Reference Number'}
                          value={<span className="font-mono">{selectedPayment.reference_number}</span>}
                        />
                      )}

                      <DetailRow
                        label={isRTL ? 'التاريخ والوقت' : 'Date & Time'}
                        value={format(new Date(selectedPayment.created_at), 'MMM dd, yyyy — HH:mm:ss')}
                      />
                    </div>
                  </div>

                  {/* Notes (for manual) */}
                  {selectedPayment.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</p>
                        <p className="text-sm bg-muted p-3 rounded-lg">{selectedPayment.notes}</p>
                      </div>
                    </>
                  )}

                  {/* Manual payment actions */}
                  {selectedPayment.source === 'manual' && selectedPayment.status === 'pending' && (
                    <>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground">{isRTL ? 'ملاحظات المشرف' : 'Admin Notes'}</label>
                        <Textarea
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder={isRTL ? 'أضف ملاحظات...' : 'Add notes...'}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => updatePaymentMutation.mutate({
                            paymentId: selectedPayment.id, status: 'approved', notes: adminNotes,
                          })}
                          disabled={updatePaymentMutation.isPending}
                        >
                          <Check className="w-4 h-4 me-2" />{isRTL ? 'اعتماد' : 'Approve'}
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => updatePaymentMutation.mutate({
                            paymentId: selectedPayment.id, status: 'rejected', notes: adminNotes,
                          })}
                          disabled={updatePaymentMutation.isPending}
                        >
                          <X className="w-4 h-4 me-2" />{isRTL ? 'رفض' : 'Reject'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPayments;
