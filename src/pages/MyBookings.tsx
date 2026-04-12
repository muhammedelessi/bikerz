import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isAfter, isBefore, startOfDay } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

type BookingRow = {
  id: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  amount: number | string | null;
  currency: string | null;
  trainer_id: string;
  trainers: { name_ar: string; name_en: string; photo_url: string | null } | null;
  trainings: { name_ar: string; name_en: string } | null;
};

const MyBookings: React.FC = () => {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const dfLocale = isRTL ? arSA : enUS;

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  const { data: list, isLoading } = useQuery({
    queryKey: ['my-training-bookings', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(
          'id, booking_date, start_time, end_time, status, amount, currency, trainer_id, trainers(name_ar, name_en, photo_url), trainings(name_ar, name_en)',
        )
        .eq('user_id', user!.id)
        .order('booking_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as BookingRow[];
    },
  });

  const filtered = useMemo(() => {
    const rows = list || [];
    const today = startOfDay(new Date());
    if (tab === 'all') return rows;
    if (tab === 'cancelled') return rows.filter((b) => b.status === 'cancelled');
    if (tab === 'completed') return rows.filter((b) => b.status === 'completed');
    if (tab === 'upcoming') {
      return rows.filter((b) => {
        if (b.status === 'cancelled' || b.status === 'completed') return false;
        if (!b.booking_date) return b.status === 'pending' || b.status === 'confirmed';
        const d0 = startOfDay(new Date(`${b.booking_date}T12:00:00`));
        return !isBefore(d0, today);
      });
    }
    return rows;
  }, [list, tab]);

  const cancelMut = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from('training_bookings').update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-training-bookings', user?.id] });
      toast.success(isRTL ? 'تم إلغاء الحجز' : 'Booking cancelled');
    },
    onError: () => toast.error(isRTL ? 'تعذر الإلغاء' : 'Could not cancel'),
  });

  const canCancel = (b: BookingRow) => {
    if (b.status !== 'confirmed' || !b.booking_date) return false;
    const d = startOfDay(new Date(`${b.booking_date}T12:00:00`));
    return isAfter(d, startOfDay(new Date()));
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      pending: isRTL ? 'معلق' : 'Pending',
      confirmed: isRTL ? 'مؤكد' : 'Confirmed',
      completed: isRTL ? 'مكتمل' : 'Completed',
      cancelled: isRTL ? 'ملغي' : 'Cancelled',
    };
    return m[s] || s;
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <div className="pt-[var(--navbar-h)] section-container py-10">
        <h1 className="text-2xl font-bold mb-6">{isRTL ? 'حجوزاتي' : 'My bookings'}</h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              {isRTL ? 'الكل' : 'All'}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs sm:text-sm">
              {isRTL ? 'القادمة' : 'Upcoming'}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs sm:text-sm">
              {isRTL ? 'المكتملة' : 'Completed'}
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs sm:text-sm">
              {isRTL ? 'الملغية' : 'Cancelled'}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-16">
            {isRTL ? 'لا توجد حجوزات في هذا التبويب.' : 'No bookings in this tab.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((b) => {
              const tr = b.trainers;
              const name = tr ? (isRTL ? tr.name_ar : tr.name_en) : '—';
              const tn = b.trainings ? (isRTL ? b.trainings.name_ar : b.trainings.name_en) : '—';
              const dateStr =
                b.booking_date &&
                format(new Date(b.booking_date + 'T12:00:00'), 'd MMM yyyy', { locale: dfLocale });
              const timeStr =
                b.start_time && b.end_time
                  ? `${String(b.start_time).slice(0, 5)} — ${String(b.end_time).slice(0, 5)}`
                  : '';
              return (
                <Card key={b.id} className="overflow-hidden border-border/60">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={tr?.photo_url || undefined} alt={name} />
                      <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 text-start">
                      <CardTitle className="text-base truncate">{name}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{tn}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {statusBadge(b.status)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      {dateStr} · <span dir="ltr">{timeStr}</span>
                    </p>
                    <p className="font-semibold" dir="ltr">
                      {Number(b.amount || 0).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}{' '}
                      {b.currency === 'SAR' ? '﷼' : b.currency}
                    </p>
                    {canCancel(b) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={cancelMut.isPending}
                        onClick={() => {
                          if (window.confirm(isRTL ? 'إلغاء هذا الحجز؟' : 'Cancel this booking?')) {
                            cancelMut.mutate(b.id);
                          }
                        }}
                      >
                        {isRTL ? 'إلغاء الحجز' : 'Cancel booking'}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Button asChild variant="link">
            <Link to="/trainings">{isRTL ? 'تصفح التدريبات' : 'Browse trainings'}</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MyBookings;
