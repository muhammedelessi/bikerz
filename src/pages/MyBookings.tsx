import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar, CalendarDays, CheckCircle2 } from 'lucide-react';
import { normalizeBookingSessions } from '@/lib/trainingBookingSessions';
import { getNextSession } from '@/lib/bookingTime';
import BookingTimeDisplay from '@/components/common/BookingTimeDisplay';
import { cn } from '@/lib/utils';

type BookingRow = {
  id: string;
  created_at: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  sessions: unknown;
  status: string;
  payment_status: string;
  amount: number | string | null;
  currency: string | null;
  trainer_id: string;
  trainers: { id: string; name_ar: string; name_en: string; photo_url: string | null } | null;
  trainings: { id: string; name_ar: string; name_en: string } | null;
};

const MyBookings: React.FC = () => {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [navigate, user]);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(
          'id, created_at, booking_date, start_time, end_time, sessions, status, payment_status, amount, currency, trainer_id, trainers(id, name_ar, name_en, photo_url), trainings(id, name_ar, name_en)',
        )
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BookingRow[];
    },
  });

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return bookings;
    if (activeFilter === 'upcoming') {
      return bookings.filter((b) => {
        const sessions = normalizeBookingSessions(b.sessions, b.booking_date, b.start_time, b.end_time, b.status);
        return (b.status === 'confirmed' || b.status === 'pending') && sessions.some((s) => s.status === 'pending');
      });
    }
    if (activeFilter === 'completed') return bookings.filter((b) => b.status === 'completed');
    if (activeFilter === 'cancelled') return bookings.filter((b) => b.status === 'cancelled');
    return bookings;
  }, [activeFilter, bookings]);

  const counts = useMemo(() => {
    const all = bookings.length;
    const upcoming = bookings.filter((b) => {
      const sessions = normalizeBookingSessions(b.sessions, b.booking_date, b.start_time, b.end_time, b.status);
      return (b.status === 'confirmed' || b.status === 'pending') && sessions.some((s) => s.status === 'pending');
    }).length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    return { all, upcoming, completed, cancelled };
  }, [bookings]);

  const activeBookingsCount = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length,
    [bookings],
  );

  const statusBadge = (s: string) => {
    const m: Record<string, { label: string; cls: string }> = {
      pending: { label: isRTL ? 'معلق' : 'Pending', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
      confirmed: { label: isRTL ? 'مؤكد' : 'Confirmed', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
      completed: { label: isRTL ? 'مكتمل' : 'Completed', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
      cancelled: { label: isRTL ? 'ملغي' : 'Cancelled', cls: 'bg-red-500/10 text-red-600 border-red-500/20' },
    };
    return m[s] || m.pending;
  };

  const paymentBadge = (s: string) => {
    const paid = s === 'paid';
    return {
      label: paid ? (isRTL ? 'مدفوع' : 'Paid') : isRTL ? 'غير مدفوع' : 'Unpaid',
      cls: paid
        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
        : 'bg-red-500/10 text-red-600 border-red-500/20',
    };
  };

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('my-bookings-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'training_bookings', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['my-bookings', user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="page-container py-8 pt-[calc(var(--navbar-h)+1.25rem)]" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-black">{isRTL ? 'حجوزاتي' : 'My Bookings'}</h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? `${activeBookingsCount} حجوزات نشطة` : `${activeBookingsCount} active bookings`}
            </p>
          </header>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all' as const, label: isRTL ? 'الكل' : 'All', count: counts.all },
              { key: 'upcoming' as const, label: isRTL ? 'القادمة' : 'Upcoming', count: counts.upcoming },
              { key: 'completed' as const, label: isRTL ? 'المكتملة' : 'Completed', count: counts.completed },
              { key: 'cancelled' as const, label: isRTL ? 'الملغية' : 'Cancelled', count: counts.cancelled },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs sm:text-sm transition-colors',
                  activeFilter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:border-primary/50',
                )}
              >
                {f.label} {f.count}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">{isRTL ? 'لا توجد حجوزات' : 'No bookings yet'}</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {isRTL
                  ? 'احجز تدريبك العملي الأول مع أحد مدربينا المحترفين'
                  : 'Book your first practical training with one of our professional trainers'}
              </p>
              <Button onClick={() => navigate('/trainings')}>
                {isRTL ? 'استعرض التدريبات' : 'Browse Trainings'}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((b) => {
                const tr = b.trainers;
                const name = tr ? (isRTL ? tr.name_ar : tr.name_en) : '—';
                const tn = b.trainings ? (isRTL ? b.trainings.name_ar : b.trainings.name_en) : '—';
                const sessions = normalizeBookingSessions(b.sessions, b.booking_date, b.start_time, b.end_time, b.status);
                const nextS = getNextSession(sessions);
                const hasUpcoming = !!nextS && new Date(`${nextS.date}T${nextS.start_time}`) > new Date();
                const completedCount = sessions.filter((s) => s.status === 'completed').length;
                const progress = sessions.length ? (completedCount / sessions.length) * 100 : 0;
                const statusView =
                  b.status === 'cancelled' ? 'cancelled' : sessions.length > 0 && completedCount === sessions.length ? 'completed' : 'confirmed';
                const statusV = statusBadge(statusView);
                const payV = paymentBadge(b.payment_status);

                return (
                  <Card key={b.id} className="rounded-xl border border-border bg-card">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={tr?.photo_url || undefined} alt={name} />
                          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 text-start">
                          <p className="text-base font-semibold truncate">{name}</p>
                          <p className="text-sm text-muted-foreground truncate">{tn}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Badge variant="outline" className={cn('text-xs', statusV.cls)}>
                            {statusV.label}
                          </Badge>
                          <Badge variant="outline" className={cn('text-xs', payV.cls)}>
                            {payV.label}
                          </Badge>
                        </div>
                      </div>

                      {sessions.length > 1 ? (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{isRTL ? `${completedCount} من ${sessions.length} جلسات` : `${completedCount} of ${sessions.length} sessions`}</span>
                            <span className="font-medium">{Math.round(progress)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      ) : null}

                      <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-muted/10">
                        {sessions.map((session, i) => {
                          const isPast = session.status === 'completed';
                          const isNext = !isPast && sessions.slice(0, i).every((s) => s.status === 'completed');
                          return (
                            <div
                              key={`${session.session_number}-${session.date}`}
                              className={cn('flex items-center gap-3 px-3 py-2 text-sm', isPast ? 'text-muted-foreground' : 'text-foreground')}
                            >
                              {isPast ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : isNext ? (
                                <div className="w-4 h-4 rounded-full border-2 border-primary bg-primary/20 shrink-0 animate-pulse" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
                              )}

                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{isRTL ? `الجلسة ${session.session_number}` : `Session ${session.session_number}`}</span>
                                <span className="text-muted-foreground mx-2">·</span>
                                <span>
                                  {format(new Date(`${session.date}T12:00:00`), isRTL ? 'EEEE، d MMM' : 'EEE, MMM d', {
                                    locale: isRTL ? ar : undefined,
                                  })}
                                </span>
                                {isPast && session.completed_at ? (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {isRTL ? 'اكتملت:' : 'Completed:'} {new Date(session.completed_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                                  </p>
                                ) : null}
                              </div>

                              <span className="text-xs text-muted-foreground shrink-0" dir="ltr">
                                {session.start_time.slice(0, 5)} — {session.end_time.slice(0, 5)}
                              </span>

                              {isNext ? (
                                <BookingTimeDisplay
                                  date={session.date}
                                  startTime={session.start_time}
                                  endTime={session.end_time}
                                  showCountdown={hasUpcoming}
                                  compact
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-lg font-bold text-primary" dir="ltr">
                          {Number(b.amount || 0).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {b.currency === 'SAR' ? '﷼' : b.currency}
                        </p>
                        {b.status === 'confirmed' && hasUpcoming && statusView !== 'cancelled' ? (
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/trainings')}>
                            <CalendarDays className="h-4 w-4" />
                            {isRTL ? 'تغيير المواعيد' : 'Reschedule'}
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MyBookings;
