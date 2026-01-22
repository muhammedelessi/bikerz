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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Search,
  MoreHorizontal,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Check,
  X,
  Filter,
  Download,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

const AdminPayments = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: payments, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles and courses separately
      const userIds = data?.map(p => p.user_id) || [];
      const courseIds = data?.filter(p => p.course_id).map(p => p.course_id) || [];
      
      const [profilesRes, coursesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        courseIds.length > 0 ? supabase.from('courses').select('id, title, title_ar').in('id', courseIds) : { data: [] },
      ]);
      
      return data?.map(payment => ({
        ...payment,
        profile: profilesRes.data?.find(p => p.user_id === payment.user_id) || null,
        course: coursesRes.data?.find(c => c.id === payment.course_id) || null,
      }));
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, status, notes }: { paymentId: string; status: string; notes?: string }) => {
      const updateData: any = {
        status,
        notes: notes || null,
      };

      if (status === 'approved') {
        updateData.approved_by = user?.id;
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('manual_payments')
        .update(updateData)
        .eq('id', paymentId);

      if (error) throw error;

      // If approved, create enrollment
      if (status === 'approved' && selectedPayment?.course_id) {
        const { error: enrollError } = await supabase
          .from('course_enrollments')
          .insert({
            user_id: selectedPayment.user_id,
            course_id: selectedPayment.course_id,
          });
        
        if (enrollError && !enrollError.message.includes('duplicate')) {
          throw enrollError;
        }
      }
      
      // Log the action
      await logAction({
        action: status === 'approved' ? 'payment_approved' : 'payment_rejected',
        entityType: 'payment',
        entityId: paymentId,
        oldData: { status: selectedPayment?.status },
        newData: { status, notes, amount: selectedPayment?.amount },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
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
    const matchesSearch = payment.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.reference_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = [
    {
      titleEn: 'Total Revenue',
      titleAr: 'إجمالي الإيرادات',
      value: `${payments?.filter(p => p.status === 'approved')?.reduce((sum, p) => sum + Number(p.amount), 0) || 0} SAR`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      titleEn: 'Pending Payments',
      titleAr: 'المدفوعات المعلقة',
      value: payments?.filter(p => p.status === 'pending')?.length || 0,
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      titleEn: 'Approved',
      titleAr: 'المعتمدة',
      value: payments?.filter(p => p.status === 'approved')?.length || 0,
      icon: CheckCircle,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      titleEn: 'Rejected',
      titleAr: 'المرفوضة',
      value: payments?.filter(p => p.status === 'rejected')?.length || 0,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <Clock className="w-3 h-3 me-1" />
          {isRTL ? 'معلق' : 'Pending'}
        </Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="w-3 h-3 me-1" />
          {isRTL ? 'معتمد' : 'Approved'}
        </Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
          <XCircle className="w-3 h-3 me-1" />
          {isRTL ? 'مرفوض' : 'Rejected'}
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
              {isRTL ? 'مراجعة واعتماد المدفوعات اليدوية' : 'Review and approve manual payments'}
            </p>
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 me-2" />
            {isRTL ? 'تصدير' : 'Export'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? stat.titleAr : stat.titleEn}
                      </p>
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

        {/* Payments Table */}
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
                    <TableHead>{isRTL ? 'طريقة الدفع' : 'Method'}</TableHead>
                    <TableHead>{isRTL ? 'رقم المرجع' : 'Reference'}</TableHead>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments?.map((payment) => {
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {payment.profile?.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {isRTL ? payment.course?.title_ar || payment.course?.title : payment.course?.title || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {Number(payment.amount).toFixed(2)} {payment.currency}
                        </TableCell>
                        <TableCell className="capitalize">
                          {payment.payment_method}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {payment.reference_number || '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(payment.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>{getStatusBadge(payment.status || 'pending')}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => setSelectedPayment(payment)}>
                                <Eye className="w-4 h-4 me-2" />
                                {isRTL ? 'عرض التفاصيل' : 'View Details'}
                              </DropdownMenuItem>
                              {payment.status === 'pending' && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedPayment(payment);
                                    }}
                                    className="text-green-600"
                                  >
                                    <Check className="w-4 h-4 me-2" />
                                    {isRTL ? 'اعتماد' : 'Approve'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedPayment(payment);
                                    }}
                                    className="text-destructive"
                                  >
                                    <X className="w-4 h-4 me-2" />
                                    {isRTL ? 'رفض' : 'Reject'}
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

        {/* Payment Details Dialog */}
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
                    <p className="font-semibold text-lg">
                      {Number(selectedPayment.amount).toFixed(2)} {selectedPayment.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? 'الحالة' : 'Status'}</p>
                    <div className="mt-1">{getStatusBadge(selectedPayment.status || 'pending')}</div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? 'طريقة الدفع' : 'Method'}</p>
                    <p className="font-medium capitalize">{selectedPayment.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? 'رقم المرجع' : 'Reference'}</p>
                    <p className="font-mono">{selectedPayment.reference_number || '-'}</p>
                  </div>
                </div>

                {selectedPayment.notes && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</p>
                    <p className="text-sm bg-muted p-2 rounded">{selectedPayment.notes}</p>
                  </div>
                )}

                {selectedPayment.status === 'pending' && (
                  <>
                    <div>
                      <label className="text-sm text-muted-foreground">
                        {isRTL ? 'ملاحظات المشرف' : 'Admin Notes'}
                      </label>
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
                          paymentId: selectedPayment.id,
                          status: 'approved',
                          notes: adminNotes,
                        })}
                        disabled={updatePaymentMutation.isPending}
                      >
                        <Check className="w-4 h-4 me-2" />
                        {isRTL ? 'اعتماد' : 'Approve'}
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => updatePaymentMutation.mutate({
                          paymentId: selectedPayment.id,
                          status: 'rejected',
                          notes: adminNotes,
                        })}
                        disabled={updatePaymentMutation.isPending}
                      >
                        <X className="w-4 h-4 me-2" />
                        {isRTL ? 'رفض' : 'Reject'}
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
