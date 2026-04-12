import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { Check, CheckCheck, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

type BookingRow = {
  id: string;
  user_id: string;
  trainer_id: string;
  training_id: string;
  trainer_course_id: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  amount: number | string | null;
  currency: string | null;
  status: string;
  payment_status: string;
  payment_id: string | null;
  notes: string | null;
  full_name: string;
  phone: string;
  email: string;
  created_at: string | null;
  trainings: { name_ar: string; name_en: string } | null;
};

function statusBadge(status: string, isRTL: boolean) {
  const map: Record<string, { className: string; ar: string; en: string }> = {
    pending: { className: 'bg-amber-500/15 text-amber-700 border-amber-500/30', ar: 'معلق', en: 'Pending' },
    confirmed: { className: 'bg-blue-500/15 text-blue-700 border-blue-500/30', ar: 'مؤكد', en: 'Confirmed' },
    completed: { className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', ar: 'مكتمل', en: 'Completed' },
    cancelled: { className: 'bg-red-500/15 text-red-700 border-red-500/30', ar: 'ملغي', en: 'Cancelled' },
  };
  const m = map[status] || map.pending;
  return (
    <Badge variant="outline" className={m.className}>
      {isRTL ? m.ar : m.en}
    </Badge>
  );
}

function payBadge(ps: string, isRTL: boolean) {
  const map: Record<string, { className: string; ar: string; en: string }> = {
    paid: { className: 'bg-emerald-500/15 text-emerald-700', ar: 'مدفوع', en: 'Paid' },
    unpaid: { className: 'bg-muted text-muted-foreground', ar: 'غير مدفوع', en: 'Unpaid' },
    refunded: { className: 'bg-violet-500/15 text-violet-700', ar: 'مسترد', en: 'Refunded' },
  };
  const m = map[ps] || map.unpaid;
  return (
    <Badge variant="secondary" className={m.className}>
      {isRTL ? m.ar : m.en}
    </Badge>
  );
}

export const TrainerBookingsManager: React.FC<{ trainerId: string; isRTL: boolean }> = ({ trainerId, isRTL }) => {
  const queryClient = useQueryClient();
  const dir = isRTL ? 'rtl' : 'ltr';
  const dfLocale = isRTL ? arSA : enUS;

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchName, setSearchName] = useState('');
  const [detailRow, setDetailRow] = useState<BookingRow | null>(null);

  const { data: rawList, isLoading } = useQuery({
    queryKey: ['trainer-admin-bookings', trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(
          'id, user_id, trainer_id, training_id, trainer_course_id, booking_date, start_time, end_time, amount, currency, status, payment_status, payment_id, notes, full_name, phone, email, created_at, trainings(name_ar, name_en)',
        )
        .eq('trainer_id', trainerId)
        .order('booking_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BookingRow[];
    },
    enabled: !!trainerId,
  });

  const filtered = useMemo(() => {
    let list = rawList || [];
    if (statusFilter !== 'all') list = list.filter((b) => b.status === statusFilter);
    if (fromDate) list = list.filter((b) => (b.booking_date || '') >= fromDate);
    if (toDate) list = list.filter((b) => (b.booking_date || '') <= toDate);
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      list = list.filter((b) => b.full_name.toLowerCase().includes(q));
    }
    return list;
  }, [rawList, statusFilter, fromDate, toDate, searchName]);

  const stats = useMemo(() => {
    const list = rawList || [];
    const total = list.length;
    const confirmed = list.filter((b) => b.status === 'confirmed').length;
    const pending = list.filter((b) => b.status === 'pending').length;
    const revenue = list
      .filter((b) => b.payment_status === 'paid' && b.status !== 'cancelled')
      .reduce((s, b) => s + Number(b.amount || 0), 0);
    return { total, confirmed, pending, revenue };
  }, [rawList]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('training_bookings').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-admin-bookings', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-bookings', trainerId] });
      toast.success(isRTL ? 'تم التحديث' : 'Updated');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return format(new Date(d + 'T12:00:00'), 'dd MMM yyyy', { locale: dfLocale });
    } catch {
      return d;
    }
  };

  const formatTimeRange = (s: string | null, e: string | null) => {
    if (!s || !e) return '—';
    const short = (t: string) => t.slice(0, 5);
    return `${short(s)} — ${short(e)}`;
  };

  const trainingLabel = (b: BookingRow) =>
    b.trainings ? (isRTL ? b.trainings.name_ar : b.trainings.name_en) : '—';

  if (isLoading) {
    return (
      <div className="space-y-3" dir={dir}>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4" dir={dir}>
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">{isRTL ? 'إجمالي الحجوزات' : 'Total bookings'}</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-emerald-600">{isRTL ? 'المؤكدة' : 'Confirmed'}</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-amber-600">{isRTL ? 'المعلقة' : 'Pending'}</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-600/30 bg-emerald-500/5">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-emerald-700">{isRTL ? 'الإيرادات' : 'Revenue'}</p>
            <p className="text-2xl font-bold text-emerald-700">
              {stats.revenue.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ﷼
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="space-y-1 min-w-[140px]">
          <Label className="text-xs">{isRTL ? 'الحالة' : 'Status'}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
              <SelectItem value="pending">{isRTL ? 'معلق' : 'Pending'}</SelectItem>
              <SelectItem value="confirmed">{isRTL ? 'مؤكد' : 'Confirmed'}</SelectItem>
              <SelectItem value="completed">{isRTL ? 'مكتمل' : 'Completed'}</SelectItem>
              <SelectItem value="cancelled">{isRTL ? 'ملغي' : 'Cancelled'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1 lg:min-w-[9.5rem]">
          <Label className="block text-xs">{isRTL ? 'من تاريخ' : 'From'}</Label>
          <div className="min-w-0 w-full [unicode-bidi:isolate]" dir="ltr" lang="en">
            <Input
              type="date"
              className="h-9 w-full text-left tabular-nums"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
        </div>
        <div className="min-w-0 space-y-1 lg:min-w-[9.5rem]">
          <Label className="block text-xs">{isRTL ? 'إلى تاريخ' : 'To'}</Label>
          <div className="min-w-0 w-full [unicode-bidi:isolate]" dir="ltr" lang="en">
            <Input
              type="date"
              className="h-9 w-full text-left tabular-nums"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1 flex-1 min-w-[160px]">
          <Label className="text-xs">{isRTL ? 'بحث بالاسم' : 'Search student'}</Label>
          <Input
            className="h-9"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder={isRTL ? 'اسم الطالب' : 'Student name'}
          />
        </div>
      </div>

      <div className="min-h-0 max-h-[min(58vh,520px)] overflow-auto rounded-lg border border-border/60 overscroll-y-contain [scrollbar-gutter:stable]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
              <TableHead>{isRTL ? 'الوقت' : 'Time'}</TableHead>
              <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
              <TableHead>{isRTL ? 'التدريب' : 'Training'}</TableHead>
              <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
              <TableHead>{isRTL ? 'حالة الدفع' : 'Payment'}</TableHead>
              <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
              <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  {isRTL ? 'لا توجد حجوزات' : 'No bookings'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(b.booking_date)}</TableCell>
                  <TableCell className="whitespace-nowrap" dir="ltr">
                    {formatTimeRange(b.start_time, b.end_time)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{b.full_name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {b.phone}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate">{trainingLabel(b)}</TableCell>
                  <TableCell dir="ltr">
                    {Number(b.amount || 0).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {b.currency === 'SAR' ? '﷼' : b.currency}
                  </TableCell>
                  <TableCell>{payBadge(b.payment_status, isRTL)}</TableCell>
                  <TableCell>{statusBadge(b.status, isRTL)}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex flex-wrap justify-end gap-1">
                      {b.status === 'pending' ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title={isRTL ? 'تأكيد' : 'Confirm'}
                          onClick={() => updateStatus.mutate({ id: b.id, status: 'confirmed' })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {b.status === 'confirmed' ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title={isRTL ? 'إكمال' : 'Complete'}
                          onClick={() => updateStatus.mutate({ id: b.id, status: 'completed' })}
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {b.status !== 'cancelled' && b.status !== 'completed' ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-destructive"
                          title={isRTL ? 'إلغاء' : 'Cancel'}
                          onClick={() => {
                            if (window.confirm(isRTL ? 'إلغاء هذا الحجز؟' : 'Cancel this booking?')) {
                              updateStatus.mutate({ id: b.id, status: 'cancelled' });
                            }
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title={isRTL ? 'التفاصيل' : 'Details'}
                        onClick={() => setDetailRow(b)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تفاصيل الحجز' : 'Booking details'}</DialogTitle>
          </DialogHeader>
          {detailRow ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">{isRTL ? 'التاريخ' : 'Date'}</span>
                <span>{formatDate(detailRow.booking_date)}</span>
                <span className="text-muted-foreground">{isRTL ? 'الوقت' : 'Time'}</span>
                <span dir="ltr">{formatTimeRange(detailRow.start_time, detailRow.end_time)}</span>
                <span className="text-muted-foreground">{isRTL ? 'الطالب' : 'Student'}</span>
                <span>{detailRow.full_name}</span>
                <span className="text-muted-foreground">{isRTL ? 'الهاتف' : 'Phone'}</span>
                <span dir="ltr">{detailRow.phone}</span>
                <span className="text-muted-foreground">{isRTL ? 'البريد' : 'Email'}</span>
                <span className="break-all">{detailRow.email}</span>
                <span className="text-muted-foreground">{isRTL ? 'التدريب' : 'Training'}</span>
                <span>{trainingLabel(detailRow)}</span>
                <span className="text-muted-foreground">{isRTL ? 'المبلغ' : 'Amount'}</span>
                <span dir="ltr">
                  {Number(detailRow.amount || 0).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}{' '}
                  {detailRow.currency === 'SAR' ? '﷼' : detailRow.currency}
                </span>
                <span className="text-muted-foreground">{isRTL ? 'حالة الدفع' : 'Payment status'}</span>
                <span>{detailRow.payment_status}</span>
                <span className="text-muted-foreground">{isRTL ? 'الحالة' : 'Status'}</span>
                <span>{detailRow.status}</span>
                <span className="text-muted-foreground">{isRTL ? 'معرف الدفع' : 'Payment ID'}</span>
                <span dir="ltr" className="break-all text-xs">
                  {detailRow.payment_id || '—'}
                </span>
                <span className="text-muted-foreground">{isRTL ? 'ملاحظات' : 'Notes'}</span>
                <span className="col-span-2">{detailRow.notes || '—'}</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailRow(null)}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
