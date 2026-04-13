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
import { normalizeBookingSessions, sessionCountLabel } from '@/lib/trainingBookingSessions';
import { getNextSession } from '@/lib/bookingTime';
import { Check, CheckCheck, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import BookingTimeDisplay from '@/components/common/BookingTimeDisplay';
import type { Json } from '@/integrations/supabase/types';

type BookingRow = {
  id: string;
  user_id: string;
  trainer_id: string;
  training_id: string;
  trainer_course_id: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  sessions: unknown;
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
          'id, user_id, trainer_id, training_id, trainer_course_id, booking_date, start_time, end_time, sessions, amount, currency, status, payment_status, payment_id, notes, full_name, phone, email, created_at, trainings(name_ar, name_en)',
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
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      toast.success(isRTL ? 'تم التحديث' : 'Updated');
    },
    onError: (e) => {
      console.error(e);
      toast.error(isRTL ? 'خطأ' : 'Error');
    },
  });

  const completeSession = useMutation({
    mutationFn: async ({ bookingId, sessionNumber }: { bookingId: string; sessionNumber: number }) => {
      const { data: row, error: fetchErr } = await supabase
        .from('training_bookings')
        .select('sessions, status')
        .eq('id', bookingId)
        .single();
      if (fetchErr) {
        console.error(fetchErr);
        throw fetchErr;
      }
      const raw = row?.sessions;
      if (!Array.isArray(raw) || raw.length === 0) {
        const err = new Error('No sessions on booking');
        console.error(err);
        throw err;
      }
      const updated = raw.map((item) => {
        const o = item as Record<string, unknown>;
        if (Number(o.session_number) === sessionNumber) {
          return { ...o, status: 'completed', completed_at: new Date().toISOString() };
        }
        return item;
      });
      const allCompleted = updated.every((x) => String((x as Record<string, unknown>).status) === 'completed');
      const { error: upErr } = await supabase
        .from('training_bookings')
        .update({
          sessions: updated as unknown as Json,
          status: allCompleted ? 'completed' : row.status,
        })
        .eq('id', bookingId);
      if (upErr) {
        console.error(upErr);
        throw upErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-admin-bookings', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-bookings', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setDetailRow(null);
      toast.success(isRTL ? 'تم تسجيل الجلسة كمكتملة' : 'Session marked complete');
    },
    onError: (e) => {
      console.error(e);
      toast.error(isRTL ? 'فشل تحديث الجلسة' : 'Could not update session');
    },
  });

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return format(new Date(d + 'T12:00:00'), 'dd MMM yyyy', { locale: dfLocale });
    } catch {
      return d;
    }
  };

  const normalizedSessions = (b: BookingRow) =>
    normalizeBookingSessions(b.sessions, b.booking_date, b.start_time, b.end_time, b.status);

  const nextSession = (b: BookingRow) => {
    const ns = normalizedSessions(b);
    return getNextSession(ns);
  };

  const sessionStatusDot = (status: string) => {
    if (status === 'cancelled') return '🔴';
    if (status === 'pending') return '🟡';
    return '🟢';
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
              <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
              <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
              <TableHead>{isRTL ? 'التدريب' : 'Training'}</TableHead>
              <TableHead>{isRTL ? 'عدد الجلسات' : 'Sessions'}</TableHead>
              <TableHead>{isRTL ? 'الجلسة القادمة' : 'Next session'}</TableHead>
              <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
              <TableHead>{isRTL ? 'حالة الدفع' : 'Payment'}</TableHead>
              <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
              <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  {isRTL ? 'لا توجد حجوزات' : 'No bookings'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{b.full_name}</div>
                  </TableCell>
                  <TableCell dir="ltr">{b.phone}</TableCell>
                  <TableCell className="max-w-[140px] truncate">{trainingLabel(b)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {sessionCountLabel(normalizedSessions(b).length, isRTL)}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {(() => {
                      const next = nextSession(b);
                      if (!next) return '—';
                      const hasUpcoming = new Date(`${next.date}T${next.start_time}`) > new Date();
                      return (
                        <BookingTimeDisplay
                          compact
                          showCountdown={hasUpcoming}
                          date={next.date}
                          startTime={next.start_time}
                          endTime={next.end_time}
                        />
                      );
                    })()}
                  </TableCell>
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
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">{isRTL ? 'الطالب' : 'Student'}</span>
                <span>{detailRow.full_name}</span>
                <span className="text-muted-foreground">{isRTL ? 'الهاتف' : 'Phone'}</span>
                <span dir="ltr">{detailRow.phone}</span>
                <span className="text-muted-foreground">{isRTL ? 'البريد' : 'Email'}</span>
                <span className="break-all" dir="ltr">
                  {detailRow.email}
                </span>
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
                <span className="text-muted-foreground">{isRTL ? 'تاريخ الحجز' : 'Booked on'}</span>
                <span>{detailRow.created_at ? formatDate(detailRow.created_at.slice(0, 10)) : '—'}</span>
                <span className="text-muted-foreground">{isRTL ? 'ملاحظات' : 'Notes'}</span>
                <span className="col-span-2">{detailRow.notes || '—'}</span>
              </div>
              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {isRTL ? 'جدول الجلسات' : 'Session schedule'}
                </p>
                <ul className="space-y-2">
                  {normalizedSessions(detailRow).length === 0 ? (
                    <li className="text-muted-foreground text-xs py-1">{isRTL ? 'لا توجد جلسات' : 'No sessions'}</li>
                  ) : (
                    normalizedSessions(detailRow).map((s) => {
                      const sessDone = String(s.status) === 'completed';
                      return (
                        <li
                          key={`${s.session_number}-${s.date}`}
                          className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-md bg-muted/20 px-2 py-2"
                        >
                          <span className="shrink-0" aria-hidden>
                            {sessionStatusDot(String(s.status || 'pending'))}
                          </span>
                          <Badge variant="secondary" className="tabular-nums shrink-0">
                            {isRTL ? `جلسة ${s.session_number}` : `Session ${s.session_number}`}
                          </Badge>
                          <BookingTimeDisplay date={s.date} startTime={s.start_time} endTime={s.end_time} />
                          {detailRow.status === 'confirmed' && !sessDone ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="ms-auto h-8"
                              disabled={completeSession.isPending}
                              onClick={() =>
                                completeSession.mutate({ bookingId: detailRow.id, sessionNumber: s.session_number })
                              }
                            >
                              {isRTL ? 'إكمال الجلسة' : 'Complete session'}
                            </Button>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ul>
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
