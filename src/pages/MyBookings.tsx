import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import SEOHead from '@/components/common/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { addDays, format, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react';
import { normalizeBookingSessions } from '@/lib/trainingBookingSessions';
import { getNextSession } from '@/lib/bookingTime';
import BookingTimeDisplay from '@/components/common/BookingTimeDisplay';
import { cn } from '@/lib/utils';
import TrainerReviewForm from '@/components/training/TrainerReviewForm';
import { toast } from 'sonner';
import {
  buildAvailabilityByDow,
  dayHasFreeSlot,
  getSlotsForDate,
  parseTrainerBookingAvailability,
  slotBooked,
  slotEndTimePg,
  timeToMinutes,
  type AvailRow,
  type BookedSlot,
  type TrainerCourseRow,
} from '@/lib/trainingBookingUtils';

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

type MyTrainerReview = {
  id: string;
  trainer_id: string;
  rating: number;
  comment: string | null;
};

type RescheduleState = {
  booking: BookingRow;
  sessionIndex: number;
};

const MyBookings: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [reviewDialogBooking, setReviewDialogBooking] = useState<BookingRow | null>(null);
  const [rescheduleState, setRescheduleState] = useState<RescheduleState | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [isSavingReschedule, setIsSavingReschedule] = useState(false);

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

  const trainerIds = useMemo(() => [...new Set(bookings.map((b) => b.trainer_id).filter(Boolean))], [bookings]);
  const { data: myReviews = [] } = useQuery({
    queryKey: ['my-trainer-reviews', user?.id, trainerIds.join(',')],
    enabled: !!user?.id && trainerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trainer_reviews')
        .select('id, trainer_id, rating, comment')
        .eq('user_id', user!.id)
        .in('trainer_id', trainerIds);
      if (error) throw error;
      return (data || []) as MyTrainerReview[];
    },
  });

  const activeRescheduleBooking = rescheduleState?.booking || null;
  const activeRescheduleSessions = useMemo(
    () =>
      activeRescheduleBooking
        ? normalizeBookingSessions(
            activeRescheduleBooking.sessions,
            activeRescheduleBooking.booking_date,
            activeRescheduleBooking.start_time,
            activeRescheduleBooking.end_time,
            activeRescheduleBooking.status,
          )
        : [],
    [activeRescheduleBooking],
  );

  const activeSession = useMemo(() => {
    if (!rescheduleState) return null;
    return activeRescheduleSessions[rescheduleState.sessionIndex] || null;
  }, [activeRescheduleSessions, rescheduleState]);

  useEffect(() => {
    if (!activeSession) return;
    const [y, m, d] = activeSession.date.split('-').map((v) => parseInt(v, 10));
    setRescheduleDate(new Date(y, m - 1, d));
    setRescheduleSlot(activeSession.start_time);
  }, [activeSession?.date, activeSession?.start_time]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const next30Days = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(today, i + 1)), [today]);
  const rescheduleBounds = useMemo(
    () => ({
      start: format(today, 'yyyy-MM-dd'),
      end: format(addDays(today, 60), 'yyyy-MM-dd'),
    }),
    [today],
  );

  const { data: trainerAvailability = [] } = useQuery({
    queryKey: ['reschedule-trainer-availability', activeRescheduleBooking?.trainer_id],
    enabled: !!activeRescheduleBooking?.trainer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_availability')
        .select('day_of_week, start_time, end_time, is_available')
        .eq('trainer_id', activeRescheduleBooking!.trainer_id);
      if (error) throw error;
      return (data || []) as AvailRow[];
    },
  });

  const { data: trainerExtras } = useQuery({
    queryKey: ['reschedule-trainer-extras', activeRescheduleBooking?.trainer_id],
    enabled: !!activeRescheduleBooking?.trainer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainers')
        .select('id, availability_settings, availability_blocked_dates, availability_special_hours')
        .eq('id', activeRescheduleBooking!.trainer_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: trainerBookedSlots = [] } = useQuery({
    queryKey: ['reschedule-booked-slots', activeRescheduleBooking?.trainer_id, rescheduleBounds.start, rescheduleBounds.end],
    enabled: !!activeRescheduleBooking?.trainer_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_trainer_booked_slots', {
        p_trainer_id: activeRescheduleBooking!.trainer_id,
        p_start_date: rescheduleBounds.start,
        p_end_date: rescheduleBounds.end,
      });
      if (error) throw error;
      const rows = (data || []) as { booking_date: string; start_time: string; status: string | null }[];
      return rows.map((r) => ({
        booking_date: r.booking_date,
        start_time: r.start_time,
        status: r.status ?? '',
      })) as BookedSlot[];
    },
  });

  const { blockedDateSet, specialHoursByDate, weeklySlotRanges } = useMemo(
    () => parseTrainerBookingAvailability(trainerExtras || null),
    [trainerExtras],
  );
  const availabilityByDow = useMemo(() => buildAvailabilityByDow(trainerAvailability), [trainerAvailability]);

  const sessionDurationHours = useMemo(() => {
    if (!activeSession) return 2;
    const mins = Math.max(30, timeToMinutes(activeSession.end_time) - timeToMinutes(activeSession.start_time));
    return mins / 60;
  }, [activeSession]);

  const pseudoCourse: TrainerCourseRow | null = useMemo(() => {
    if (!activeRescheduleBooking) return null;
    return {
      id: activeRescheduleBooking.id,
      trainer_id: activeRescheduleBooking.trainer_id,
      training_id: activeRescheduleBooking.trainings?.id || '',
      duration_hours: sessionDurationHours,
      location: '',
      price: 0,
      trainers: null,
    };
  }, [activeRescheduleBooking, sessionDurationHours]);

  const activeRescheduleDateStr = rescheduleDate ? format(rescheduleDate, 'yyyy-MM-dd') : '';
  const otherSessionDates = useMemo(() => {
    if (!rescheduleState) return new Set<string>();
    const set = new Set<string>();
    activeRescheduleSessions.forEach((s, idx) => {
      if (idx !== rescheduleState.sessionIndex) set.add(s.date);
    });
    return set;
  }, [activeRescheduleSessions, rescheduleState]);

  const prevSession = useMemo(() => {
    if (!rescheduleState || rescheduleState.sessionIndex <= 0) return null;
    return activeRescheduleSessions[rescheduleState.sessionIndex - 1] || null;
  }, [activeRescheduleSessions, rescheduleState]);

  const nextSession = useMemo(() => {
    if (!rescheduleState) return null;
    return activeRescheduleSessions[rescheduleState.sessionIndex + 1] || null;
  }, [activeRescheduleSessions, rescheduleState]);

  const canSelectRescheduleDate = (d: Date) => {
    if (!pseudoCourse) return false;
    if (d < today) return false;
    const ds = format(d, 'yyyy-MM-dd');
    if (otherSessionDates.has(ds)) return false;
    if (prevSession && ds < prevSession.date) return false;
    if (nextSession && ds > nextSession.date) return false;
    return dayHasFreeSlot(
      d,
      pseudoCourse,
      availabilityByDow,
      blockedDateSet,
      specialHoursByDate,
      trainerBookedSlots,
      weeklySlotRanges,
    );
  };

  const rescheduleSlotsForDay = useMemo(() => {
    if (!rescheduleDate || !pseudoCourse) return [];
    return getSlotsForDate(
      rescheduleDate,
      pseudoCourse,
      availabilityByDow,
      blockedDateSet,
      specialHoursByDate,
      weeklySlotRanges,
    );
  }, [availabilityByDow, blockedDateSet, pseudoCourse, rescheduleDate, specialHoursByDate, weeklySlotRanges]);

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

  const isRescheduleSlotAllowed = (slot: string) => {
    if (!activeSession || !rescheduleDate || !pseudoCourse) return false;
    const ds = format(rescheduleDate, 'yyyy-MM-dd');
    const end = slotEndTimePg(slot, pseudoCourse.duration_hours);
    const sameCurrent = ds === activeSession.date && slot === activeSession.start_time;
    const isBooked = slotBooked(ds, slot, trainerBookedSlots);
    if (isBooked && !sameCurrent) return false;
    if (prevSession) {
      const prevEndAt = new Date(`${prevSession.date}T${prevSession.end_time}`).getTime();
      const candidateStartAt = new Date(`${ds}T${slot}`).getTime();
      if (candidateStartAt <= prevEndAt) return false;
    }
    if (nextSession) {
      const nextStartAt = new Date(`${nextSession.date}T${nextSession.start_time}`).getTime();
      const candidateEndAt = new Date(`${ds}T${end}`).getTime();
      if (candidateEndAt >= nextStartAt) return false;
    }
    return true;
  };

  const handleRescheduleSave = async () => {
    if (!rescheduleState || !activeSession || !rescheduleDate || !rescheduleSlot) return;
    if (!isRescheduleSlotAllowed(rescheduleSlot)) {
      toast.error(isRTL ? 'الوقت المختار غير متاح' : 'Selected time is not available');
      return;
    }
    const ds = format(rescheduleDate, 'yyyy-MM-dd');
    if (otherSessionDates.has(ds)) {
      toast.error(isRTL ? 'لا يمكن تكرار نفس يوم جلسة أخرى' : 'Cannot reuse the same date as another session');
      return;
    }
    setIsSavingReschedule(true);
    try {
      const newEndTime = slotEndTimePg(rescheduleSlot, sessionDurationHours);
      const updatedSessions = activeRescheduleSessions.map((s, idx) =>
        idx === rescheduleState.sessionIndex
          ? { ...s, date: ds, start_time: rescheduleSlot, end_time: newEndTime }
          : s,
      );

      const updatePayload: Record<string, unknown> = { sessions: updatedSessions as any };
      if (rescheduleState.sessionIndex === 0) {
        updatePayload.booking_date = ds;
        updatePayload.start_time = rescheduleSlot;
        updatePayload.end_time = newEndTime;
      }

      const { error } = await supabase.from('training_bookings').update(updatePayload).eq('id', rescheduleState.booking.id);
      if (error) throw error;

      toast.success(isRTL ? 'تم تحديث موعد الجلسة بنجاح' : 'Session rescheduled successfully');
      setRescheduleState(null);
      setRescheduleDate(undefined);
      setRescheduleSlot(null);
      queryClient.invalidateQueries({ queryKey: ['my-bookings', user?.id] });
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? 'تعذر تغيير الموعد' : 'Could not reschedule'));
    } finally {
      setIsSavingReschedule(false);
    }
  };

  return (
    <>
      <SEOHead
        title={t('nav.myBookings')}
        description={isRTL ? 'عرض وإدارة حجوزات التدريب العملي.' : 'View and manage your practical training bookings.'}
        noindex
      />
      <div className="p-4 sm:p-6 space-y-6 safe-area-bottom max-w-6xl mx-auto w-full min-w-0" dir={isRTL ? 'rtl' : 'ltr'}>
        <p className="text-sm text-muted-foreground">
          {isRTL ? `${activeBookingsCount} حجوزات نشطة` : `${activeBookingsCount} active bookings`}
        </p>

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
                const hasCompletedSession = sessions.some((session) => session.status === 'completed');
                const canRateTrainer = (b.status === 'confirmed' || b.status === 'completed') && hasCompletedSession;
                const existingReview = myReviews.find((review) => review.trainer_id === b.trainer_id) || null;

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

                              {session.status === 'pending' ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0"
                                  onClick={() => setRescheduleState({ booking: b, sessionIndex: i })}
                                  aria-label={isRTL ? 'تغيير الموعد' : 'Reschedule'}
                                >
                                  <Clock3 className="h-4 w-4" />
                                </Button>
                              ) : null}

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

                      {canRateTrainer ? (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3">
                          {existingReview ? (
                            <>
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25">
                                {isRTL ? 'تم التقييم ✓' : 'Reviewed ✓'}
                              </Badge>
                              <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => setReviewDialogBooking(b)}>
                                {isRTL ? 'تعديل' : 'Edit'}
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setReviewDialogBooking(b)}>
                              {isRTL ? 'قيّم المدرب' : 'Rate Trainer'}
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
      </div>

      <Dialog
        open={!!rescheduleState}
        onOpenChange={(open) => {
          if (!open) {
            setRescheduleState(null);
            setRescheduleDate(undefined);
            setRescheduleSlot(null);
          }
        }}
      >
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تغيير موعد الجلسة' : 'Reschedule session'}</DialogTitle>
          </DialogHeader>
          {activeSession ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="text-muted-foreground">{isRTL ? 'الموعد الحالي' : 'Current schedule'}</p>
                <div className="mt-1">
                  <BookingTimeDisplay date={activeSession.date} startTime={activeSession.start_time} endTime={activeSession.end_time} compact />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{isRTL ? 'اختر اليوم الجديد' : 'Select new date'}</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {next30Days.map((d) => {
                    const ds = format(d, 'yyyy-MM-dd');
                    const enabled = canSelectRescheduleDate(d);
                    const selected = activeRescheduleDateStr === ds;
                    return (
                      <button
                        key={ds}
                        type="button"
                        disabled={!enabled}
                        onClick={() => {
                          if (!enabled) return;
                          setRescheduleDate(d);
                          setRescheduleSlot(null);
                        }}
                        className={cn(
                          'shrink-0 rounded-lg border px-3 py-2 text-start',
                          selected ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                          !enabled && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <div className="text-xs text-muted-foreground">
                          {format(d, isRTL ? 'EEEE' : 'EEE', { locale: isRTL ? ar : undefined })}
                        </div>
                        <div className="text-sm font-semibold">{format(d, isRTL ? 'd MMM' : 'MMM d', { locale: isRTL ? ar : undefined })}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {rescheduleDate ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{isRTL ? 'اختر الوقت الجديد' : 'Select new time'}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {rescheduleSlotsForDay.map((slot) => {
                      const selected = rescheduleSlot === slot;
                      const allowed = isRescheduleSlotAllowed(slot);
                      const end = slotEndTimePg(slot, sessionDurationHours);
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={!allowed}
                          onClick={() => setRescheduleSlot(slot)}
                          className={cn(
                            'rounded-lg border px-2 py-2 text-center text-sm',
                            selected ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                            !allowed && 'opacity-40 cursor-not-allowed',
                          )}
                        >
                          <span dir="ltr" className="tabular-nums">
                            {slot.slice(0, 5)} — {end.slice(0, 5)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRescheduleState(null);
                    setRescheduleDate(undefined);
                    setRescheduleSlot(null);
                  }}
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={() => void handleRescheduleSave()} disabled={!rescheduleDate || !rescheduleSlot || isSavingReschedule}>
                  {isSavingReschedule ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : isRTL ? 'تأكيد التغيير' : 'Confirm reschedule'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewDialogBooking} onOpenChange={(open) => !open && setReviewDialogBooking(null)}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تقييم المدرب' : 'Rate trainer'}</DialogTitle>
          </DialogHeader>
          {reviewDialogBooking ? (
            <TrainerReviewForm
              trainerId={reviewDialogBooking.trainer_id}
              trainingId={reviewDialogBooking.trainings?.id ?? null}
              existingReview={myReviews.find((r) => r.trainer_id === reviewDialogBooking.trainer_id) || null}
              onSuccess={() => {
                setReviewDialogBooking(null);
                queryClient.invalidateQueries({ queryKey: ['my-trainer-reviews', user?.id] });
                queryClient.invalidateQueries({ queryKey: ['trainer-profile-reviews', reviewDialogBooking.trainer_id] });
                queryClient.invalidateQueries({ queryKey: ['trainer-review-agg', reviewDialogBooking.trainer_id] });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MyBookings;
