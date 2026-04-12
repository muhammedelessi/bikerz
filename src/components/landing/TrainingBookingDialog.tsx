import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, startOfDay } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency, TRAINING_PRICE_PLACEHOLDER_COURSE_ID } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useTapPayment } from '@/hooks/useTapPayment';
import { writePendingTrainingBooking } from '@/lib/trainingBookingStorage';
import {
  type TrainerCourseRow,
  type AvailRow,
  type BookedSlot,
  parseTrainerBookingAvailability,
  getSlotsForDate,
  hasUnbookedSlotInRange,
  buildAvailabilityByDow,
  slotBooked,
  slotEndTimePg,
  formatTime12hClock,
  formatTimeClockOnly,
  slotPeriodLabel,
  durationBookingLabel,
  dayHasFreeSlot,
} from '@/lib/trainingBookingUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TrainingMini = { id: string; name_ar: string; name_en: string } | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: TrainingMini;
  selectedCourse: TrainerCourseRow | null;
  returnTo: string;
};

const TrainingBookingDialog: React.FC<Props> = ({ open, onOpenChange, training, selectedCourse, returnTo }) => {
  const { isRTL, language } = useLanguage();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { getCoursePriceInfo, isSAR, exchangeRate, formatPriceValueThenCurrencyName } = useCurrency();
  const tap = useTapPayment();

  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const trainerId = selectedCourse?.trainer_id;

  const bookingRangeStart = useMemo(() => format(startOfDay(new Date()), 'yyyy-MM-dd'), [open]);
  const bookingRangeEnd = useMemo(() => format(addDays(startOfDay(new Date()), 24), 'yyyy-MM-dd'), [open]);

  const next14Days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, [open]);

  const availabilityQuery = useQuery({
    queryKey: ['trainer-availability-public', trainerId],
    enabled: !!trainerId && open,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_availability')
        .select('day_of_week, start_time, end_time, is_available')
        .eq('trainer_id', trainerId!);
      if (error) throw error;
      return (data || []) as AvailRow[];
    },
  });
  const availability = availabilityQuery.data ?? [];

  const extrasQuery = useQuery({
    queryKey: ['trainer-booking-extras', trainerId],
    enabled: !!trainerId && open,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainers')
        .select('*')
        .eq('id', trainerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const trainerBookingExtras = extrasQuery.data;

  const { blockedDateSet, specialHoursByDate, weeklySlotRanges } = useMemo(
    () => parseTrainerBookingAvailability(trainerBookingExtras),
    [trainerBookingExtras],
  );

  const bookedSlotsQuery = useQuery({
    queryKey: ['training-bookings-slots', trainerId, bookingRangeStart, bookingRangeEnd],
    enabled: !!trainerId && open,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_trainer_booked_slots', {
        p_trainer_id: trainerId!,
        p_start_date: bookingRangeStart,
        p_end_date: bookingRangeEnd,
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
  const bookedSlots = bookedSlotsQuery.data ?? [];

  const availByDow = useMemo(() => buildAvailabilityByDow(availability), [availability]);

  /** v5: refetch with cached [] leaves isLoading false — wait until first paint has real rows or fetch settled */
  const slotsDataLoading =
    open &&
    !!trainerId &&
    (availabilityQuery.isPending ||
      (availabilityQuery.isFetching && availability.length === 0) ||
      extrasQuery.isPending ||
      bookedSlotsQuery.isPending);

  const slotsScheduleError =
    open && !!trainerId && (availabilityQuery.isError || extrasQuery.isError || bookedSlotsQuery.isError);

  const hasBookableSlotNext14Days = useMemo(() => {
    if (!selectedCourse || !open) return true;
    if (slotsDataLoading) return true;
    return hasUnbookedSlotInRange(
      selectedCourse,
      availByDow,
      blockedDateSet,
      specialHoursByDate,
      bookedSlots,
      14,
      weeklySlotRanges,
    );
  }, [
    selectedCourse,
    open,
    slotsDataLoading,
    availByDow,
    blockedDateSet,
    specialHoursByDate,
    bookedSlots,
    weeklySlotRanges,
  ]);

  const slotsForSelectedDay = useMemo(() => {
    if (!selectedDate || !selectedCourse) return [];
    return getSlotsForDate(selectedDate, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges);
  }, [selectedDate, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges]);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  const trainerForDialog = selectedCourse?.trainers;
  const trainerName = trainerForDialog
    ? isRTL
      ? trainerForDialog.name_ar
      : trainerForDialog.name_en
    : '';

  const calendarLocale = isRTL ? arSA : undefined;

  const priceInfo = useMemo(() => {
    if (!selectedCourse) return null;
    return getCoursePriceInfo(TRAINING_PRICE_PLACEHOLDER_COURSE_ID, Number(selectedCourse.price), 0);
  }, [selectedCourse, getCoursePriceInfo]);

  useEffect(() => {
    if (!open || !user) return;
    setFullName(profile?.full_name?.trim() || '');
    const raw = profile?.phone?.trim() || '';
    const digits = raw.replace(/^\+966\s?/i, '').replace(/\D/g, '');
    setPhone(digits);
    setEmail(user.email?.trim() || '');
  }, [open, user, profile]);

  useEffect(() => {
    if (!open) {
      setStep('pick');
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setNotes('');
      setPaying(false);
      tap.reset();
    }
    // tap.reset is stable for our purposes when dialog closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (tap.status === 'failed' && tap.error) {
      toast.error(tap.error);
      setPaying(false);
    }
  }, [tap.status, tap.error]);

  const goDetails = () => {
    if (!selectedDate || !selectedSlot || !selectedCourse) {
      toast.error(isRTL ? 'اختر اليوم والوقت' : 'Pick a day and time slot');
      return;
    }
    setStep('details');
  };

  const handlePay = async () => {
    if (!user || !selectedCourse || !training || !selectedDate || !selectedSlot || !priceInfo) return;
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    const phoneOut = digits ? `+966${digits}` : '';
    if (!fullName.trim() || !phoneOut || !email.trim()) {
      toast.error(isRTL ? 'يرجى تعبئة الاسم والهاتف والبريد' : 'Please fill name, phone, and email');
      return;
    }

    const TAP_SUPPORTED = ['SAR', 'KWD', 'AED', 'USD', 'BHD', 'QAR', 'OMR', 'EGP'];
    const localCurrency = priceInfo.currency as string;
    const base = priceInfo.finalPrice;
    let paymentCurrency: string;
    let paymentAmount: number;
    if (TAP_SUPPORTED.includes(localCurrency)) {
      paymentCurrency = localCurrency;
      paymentAmount = base;
    } else {
      paymentCurrency = 'SAR';
      paymentAmount = isSAR || exchangeRate <= 0 ? base : Math.ceil(base / exchangeRate);
    }

    const endTime = slotEndTimePg(selectedSlot, selectedCourse.duration_hours);

    writePendingTrainingBooking({
      trainer_course_id: selectedCourse.id,
      trainer_id: selectedCourse.trainer_id,
      training_id: training.id,
      booking_date: dateStr,
      start_time: selectedSlot,
      end_time: endTime,
      notes: notes.trim(),
      full_name: fullName.trim(),
      phone: phoneOut,
      email: email.trim(),
      payment_amount: paymentAmount,
      payment_currency: paymentCurrency,
    });

    setPaying(true);
    try {
      await tap.submitPayment({
        paymentKind: 'training_booking',
        trainerCourseId: selectedCourse.id,
        trainingId: training.id,
        currency: paymentCurrency,
        amount: paymentAmount,
        customerName: fullName.trim(),
        customerEmail: email.trim(),
        customerPhone: phoneOut,
        courseName: isRTL ? training.name_ar : training.name_en,
        isRTL,
      });
    } catch {
      setPaying(false);
    }
  };

  const dayChipLabel = useCallback(
    (d: Date) => {
      const dow = format(d, 'EEE', { locale: calendarLocale });
      const dm = format(d, 'd/M');
      return { dow, dm };
    },
    [calendarLocale],
  );

  const isDateSelected = (d: Date) => selectedDate && format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-lg"
        dir={isRTL ? 'rtl' : 'ltr'}
        lang={language}
      >
        <DialogHeader>
          <DialogTitle>
            {!training
              ? isRTL
                ? 'جاري التحميل…'
                : 'Loading…'
              : step === 'pick'
                ? isRTL
                  ? 'اختر اليوم والوقت'
                  : 'Choose day & time'
                : isRTL
                  ? 'ملخص الحجز والبيانات'
                  : 'Booking summary & details'}
          </DialogTitle>
          {training && selectedCourse && trainerForDialog && (
            <DialogDescription className="text-start space-y-1">
              <span className="block font-medium text-foreground">{isRTL ? training.name_ar : training.name_en}</span>
              <span className="block text-sm">
                {isRTL ? 'المدرب:' : 'Trainer:'} {trainerName}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {!training ? (
          <div className="py-8">
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : authLoading ? (
          <div className="py-8 flex justify-center">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !user ? (
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">{isRTL ? 'يرجى تسجيل الدخول لإتمام الحجز' : 'Please sign in to complete your booking'}</p>
            <Button asChild className="w-full">
              <Link to={`/login?returnTo=${returnTo}`}>{isRTL ? 'تسجيل الدخول' : 'Sign in'}</Link>
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {step === 'pick' ? (
              <motion.div
                key="pick"
                initial={{ opacity: 0, x: isRTL ? 12 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? -8 : 8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                {slotsDataLoading ? (
                  <div className="space-y-4 py-1">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-28 w-full rounded-xl" />
                  </div>
                ) : slotsScheduleError ? (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm leading-relaxed text-destructive">
                    {isRTL
                      ? 'تعذر تحميل جدول المواعيد. حدّث الصفحة أو حاول لاحقاً.'
                      : 'Could not load the schedule. Refresh the page or try again later.'}
                  </p>
                ) : !hasBookableSlotNext14Days ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground">
                      {isRTL ? 'لا توجد أوقات حجز متاحة خلال الأيام الـ14 القادمة' : 'No bookable times in the next 14 days'}
                    </p>
                    <p>
                      {isRTL
                        ? 'إن كان المدرب قد ضبط أوقاتاً رسمية: تأكد أن مدة الجلسة أقصر من أو تساوي نافذة التوفر، وأن التواريخ غير محظورة بالكامل، وأن المواعيد غير ممتلئة بالحجوزات.'
                        : 'If the trainer set weekly hours: ensure the session duration fits inside each window, dates are not all blocked, and slots are not already fully booked.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="mb-2 block text-muted-foreground">{isRTL ? 'اليوم' : 'Day'}</Label>
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                        {next14Days.map((date) => {
                          const ds = format(date, 'yyyy-MM-dd');
                          const enabled =
                            selectedCourse &&
                            dayHasFreeSlot(date, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, bookedSlots, weeklySlotRanges);
                          const { dow, dm } = dayChipLabel(date);
                          const sel = isDateSelected(date);
                          return (
                            <button
                              key={ds}
                              type="button"
                              disabled={!enabled}
                              onClick={() => {
                                if (!enabled) return;
                                setSelectedDate(date);
                                setSelectedSlot(null);
                              }}
                              className={cn(
                                'flex flex-col items-center p-3 rounded-xl border min-w-[64px] transition-colors shrink-0',
                                sel && 'bg-primary text-primary-foreground border-primary',
                                !enabled && 'opacity-40 cursor-not-allowed',
                                enabled && !sel && 'hover:border-primary/50 cursor-pointer border-border bg-card',
                              )}
                            >
                              <span className="text-[11px] font-medium opacity-90">{dow}</span>
                              <span className="text-sm font-bold tabular-nums">{dm}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedDate && selectedCourse && (
                        <motion.div
                          key="slots"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-2"
                        >
                          <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
                          {slotsForSelectedDay.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              {isRTL ? 'لا توجد أوقات في هذا اليوم.' : 'No slots on this day.'}
                            </p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {slotsForSelectedDay.map((slot) => {
                                const booked = slotBooked(dateStr, slot, bookedSlots);
                                const selected = selectedSlot === slot;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    disabled={booked}
                                    onClick={() => {
                                      if (!booked) setSelectedSlot(slot);
                                    }}
                                    className={cn(
                                      'p-3 rounded-xl border text-center transition-colors min-h-[72px] flex flex-col items-center justify-center',
                                      booked && 'opacity-40 cursor-not-allowed line-through',
                                      !booked && !selected && 'hover:border-primary/50 border-border bg-card',
                                      !booked && selected && 'bg-primary text-primary-foreground border-primary',
                                    )}
                                  >
                                    <div className="font-bold tabular-nums text-sm">{formatTimeClockOnly(slot, isRTL)}</div>
                                    <div className="text-[11px] opacity-70">{slotPeriodLabel(slot, isRTL)}</div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button
                      type="button"
                      className="w-full gap-2"
                      disabled={!selectedDate || !selectedSlot}
                      onClick={() => goDetails()}
                    >
                      {isRTL ? 'متابعة إلى الملخص' : 'Continue to summary'}
                      {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </>
                )}

                <DialogFooter className={cn('gap-2 sm:gap-0', isRTL && 'flex-row-reverse')}>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Button>
                </DialogFooter>
              </motion.div>
            ) : (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: isRTL ? -14 : 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 8 : -8 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                {trainerForDialog && selectedCourse && selectedDate && selectedSlot && (
                  <Card className="border-primary/20 bg-primary/5 shadow-sm">
                    <CardHeader className="space-y-1 pb-2 pt-4">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        {isRTL ? 'ملخص الحجز' : 'Booking summary'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4 text-sm">
                      <div className="grid gap-2 text-start">
                        <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                          <span className="text-muted-foreground">{isRTL ? 'المدرب' : 'Trainer'}</span>
                          <span className="font-medium">{trainerName}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                          <span className="text-muted-foreground">{isRTL ? 'التدريب' : 'Training'}</span>
                          <span className="font-medium">{isRTL ? training.name_ar : training.name_en}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                          <span className="text-muted-foreground">{isRTL ? 'التاريخ' : 'Date'}</span>
                          <span className="font-medium">
                            {format(selectedDate, isRTL ? 'EEEE، d MMMM yyyy' : 'EEEE, d MMMM yyyy', {
                              locale: calendarLocale,
                            })}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                          <span className="text-muted-foreground">{isRTL ? 'الوقت' : 'Time'}</span>
                          <span className="font-medium tabular-nums" dir="ltr">
                            {formatTime12hClock(selectedSlot, isRTL)} —{' '}
                            {formatTime12hClock(slotEndTimePg(selectedSlot, selectedCourse.duration_hours), isRTL)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                          <span className="text-muted-foreground">{isRTL ? 'المدة' : 'Duration'}</span>
                          <span className="font-medium">{durationBookingLabel(selectedCourse.duration_hours, isRTL)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                          <span className="text-muted-foreground">{isRTL ? 'السعر' : 'Price'}</span>
                          <span
                            className="font-semibold tabular-nums text-primary"
                            dir={isRTL ? 'rtl' : 'ltr'}
                            lang={isRTL ? 'ar' : 'en'}
                          >
                            {priceInfo ? formatPriceValueThenCurrencyName(priceInfo, isRTL) : ''}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="tbd-full-name">{isRTL ? 'الاسم الكامل' : 'Full name'}</Label>
                  <Input id="tbd-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tbd-phone">{isRTL ? 'الهاتف' : 'Phone'}</Label>
                  <div className="flex gap-2 items-stretch" dir="ltr">
                    <span className="flex items-center rounded-md border border-input bg-muted/40 px-2.5 text-xs text-muted-foreground shrink-0">
                      +966
                    </span>
                    <Input
                      id="tbd-phone"
                      className="flex-1 min-w-0"
                      type="tel"
                      placeholder={isRTL ? '5xxxxxxxx' : '5xxxxxxxx'}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      autoComplete="tel"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{isRTL ? 'أدخل الرقم بدون المفتاح إن وُجد في ملفك.' : 'Enter digits without country code if your profile already includes it.'}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tbd-email">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
                  <Input id="tbd-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" className="text-start" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tbd-notes">{isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
                  <Textarea id="tbd-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                <Separator />

                {priceInfo && (
                  <p className="text-lg font-bold flex justify-between items-center gap-2">
                    <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                    <span dir={isRTL ? 'rtl' : 'ltr'} className="tabular-nums" lang={isRTL ? 'ar' : 'en'}>
                      {formatPriceValueThenCurrencyName(priceInfo, isRTL)}
                    </span>
                  </p>
                )}

                <DialogFooter className={cn('flex-col sm:flex-row gap-2 pt-1', isRTL && 'sm:flex-row-reverse')}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setStep('pick');
                    }}
                    disabled={paying || tap.status === 'processing'}
                  >
                    {isRTL ? '← تغيير الموعد' : '← Change date & time'}
                  </Button>
                  <Button
                    type="button"
                    className="w-full sm:flex-1 gap-2"
                    onClick={() => void handlePay()}
                    disabled={paying || tap.status === 'processing'}
                  >
                    {paying || tap.status === 'processing' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {isRTL ? 'تأكيد الحجز والدفع →' : 'Confirm booking & pay →'}
                  </Button>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TrainingBookingDialog;
