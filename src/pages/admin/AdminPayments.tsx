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
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Search, MoreHorizontal, DollarSign, Clock, CheckCircle, XCircle,
  Eye, Check, X, Download, CreditCard, Banknote,
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
  error_message?: string | null;
  // joined
  profile?: { full_name: string | null } | null;
  course?: { title: string | null; title_ar: string | null } | null;
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
        error_message: p.error_message,
        payment_method: p.payment_method || 'card',
      }));

      const all = [...manualData, ...tapData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Fetch profiles and courses
      const userIds = [...new Set(all.map((p) => p.user_id))];
      const courseIds = [...new Set(all.filter((p) => p.course_id).map((p) => p.course_id!))];

      const [profilesRes, coursesRes] = await Promise.all([
        userIds.length > 0 ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) : { data: [] },
        courseIds.length > 0 ? supabase.from('courses').select('id, title, title_ar').in('id', courseIds) : { data: [] },
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
      payment.charge_id?.toLowerCase().includes(searchQuery.toLowerCase());
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
          <Button variant="outline">
            <Download className="w-4 h-4 me-2" />
            {isRTL ? 'تصدير' : 'Export'}
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
                  placeholder={isRTL ? 'البحث بالاسم أو رقم المرجع...' : 'Search by name or reference...'}
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
                    return (
                      <TableRow key={`${payment.source}-${payment.id}`}>
                        <TableCell className="font-medium">{displayName}</TableCell>
                        <TableCell>
                          {isRTL
                            ? payment.course?.title_ar || payment.course?.title || 'N/A'
                            : payment.course?.title || 'N/A'}
                        </TableCell>
                        <TableCell>{payment.amount.toFixed(2)} {payment.currency}</TableCell>
                        <TableCell>{getSourceBadge(payment.source)}</TableCell>
                        <TableCell className="capitalize">
                          {payment.source === 'tap' && payment.card_brand
                            ? `${payment.card_brand} •••• ${payment.card_last_four || ''}`
                            : payment.payment_method || '-'}
                        </TableCell>
                        <TableCell>{format(new Date(payment.created_at), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{getStatusBadge(payment.status, payment.source)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
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

        {/* Detail Dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'تفاصيل الدفع' : 'Payment Details'}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'مراجعة واتخاذ إجراء بشأن هذا الدفع' : 'Review and take action on this payment'}
              </DialogDescription>
            </DialogHeader>

            {selectedPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{isRTL ? 'المبلغ' : 'Amount'}</p>
                    <p className="font-semibold text-lg">{selectedPayment.amount.toFixed(2)} {selectedPayment.currency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? 'الحالة' : 'Status'}</p>
                    <div className="mt-1">{getStatusBadge(selectedPayment.status, selectedPayment.source)}</div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? 'النوع' : 'Type'}</p>
                    <div className="mt-1">{getSourceBadge(selectedPayment.source)}</div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? 'طريقة الدفع' : 'Method'}</p>
                    <p className="font-medium capitalize">{selectedPayment.payment_method || '-'}</p>
                  </div>
                  {selectedPayment.source === 'manual' && (
                    <div>
                      <p className="text-muted-foreground">{isRTL ? 'رقم المرجع' : 'Reference'}</p>
                      <p className="font-mono">{selectedPayment.reference_number || '-'}</p>
                    </div>
                  )}
                  {selectedPayment.source === 'tap' && (
                    <>
                      <div>
                        <p className="text-muted-foreground">{isRTL ? 'رقم العملية' : 'Charge ID'}</p>
                        <p className="font-mono text-xs">{selectedPayment.charge_id || '-'}</p>
                      </div>
                      {selectedPayment.card_brand && (
                        <div>
                          <p className="text-muted-foreground">{isRTL ? 'البطاقة' : 'Card'}</p>
                          <p className="font-medium">{selectedPayment.card_brand} •••• {selectedPayment.card_last_four}</p>
                        </div>
                      )}
                      {selectedPayment.customer_email && (
                        <div>
                          <p className="text-muted-foreground">{isRTL ? 'البريد' : 'Email'}</p>
                          <p className="text-xs">{selectedPayment.customer_email}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {selectedPayment.error_message && (
                  <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                    {selectedPayment.error_message}
                  </div>
                )}

                {selectedPayment.notes && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</p>
                    <p className="text-sm bg-muted p-2 rounded">{selectedPayment.notes}</p>
                  </div>
                )}

                {selectedPayment.source === 'manual' && selectedPayment.status === 'pending' && (
                  <>
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
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPayments;
