import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format, addDays, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency, TRAINING_PRICE_PLACEHOLDER_COURSE_ID } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useTapPayment } from '@/hooks/useTapPayment';
import { RecoverableTapSourceUsedError } from '@/services/payment.service';
import Checkout3DSModal from '@/components/checkout/Checkout3DSModal';
import { writePendingTrainingBooking, clearPendingTrainingBooking } from '@/lib/trainingBookingStorage';
import { insertUserTrainingBooking } from '@/lib/trainingBookingInsert';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Check, ChevronLeft, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTrainingPlatformPricing } from '@/hooks/useTrainingPlatformPricing';
import { applyTrainingPlatformMarkupSar, trainingCustomerChargeTotalSar } from '@/lib/trainingPlatformMarkup';
import BookingTimeDisplay from '@/components/common/BookingTimeDisplay';
import { formatBookingTime, formatTimeFromMinutesSinceMidnight, pgTimeStringToMinutes } from '@/utils/formatDateTime';
import { FormField } from '@/components/ui/form-field';
import { joinFullName, splitFullName } from '@/lib/nameUtils';

type TrainingMini = { id: string; name_ar: string; name_en: string } | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: TrainingMini;
  selectedCourse: TrainerCourseRow | null;
  returnTo: string;
};

const TrainingBookingDialog: React.FC<Props> = ({ open, onOpenChange, training, selectedCourse, returnTo }) => {
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { t } = useTranslation();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { getCoursePriceInfo, formatPriceValueThenCurrencyName } = useCurrency();
  const tap = useTapPayment();

  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const trainerId = selectedCourse?.trainer_id;

  const bookingRangeStart = useMemo(() => format(startOfDay(new Date()), 'yyyy-MM-dd'), [open]);
  const bookingRangeEnd = useMemo(() => format(addDays(startOfDay(new Date()), 24), 'yyyy-MM-dd'), [open]);

  const next30Days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 30 }, (_, i) => addDays(today, i + 1));
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
        .select('id,name_ar,name_en,photo_url,bio_ar,bio_en,country,city,bike_type,years_of_experience,services,status,profit_ratio,motorbike_brand,license_type,bike_photos,album_photos,bike_entries,availability_blocked_dates,availability_special_hours,availability_settings,language_levels,user_id,created_at')
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

  const hasBookableSlotNext30Days = useMemo(() => {
    if (!selectedCourse || !open) return true;
    if (slotsDataLoading) return true;
    return hasUnbookedSlotInRange(
      selectedCourse,
      availByDow,
      blockedDateSet,
      specialHoursByDate,
      bookedSlots,
      31,
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

  const { data: pricing } = useTrainingPlatformPricing();
  const trainingPlatformMarkupPct = pricing?.markupPercent ?? 0;
  const trainingPlatformVatPct = pricing?.vatPercent ?? 0;

  const chargeSarTotal = useMemo(() => {
    if (!selectedCourse) return 0;
    return trainingCustomerChargeTotalSar(
      Number(selectedCourse.price),
      trainingPlatformMarkupPct,
      trainingPlatformVatPct,
    );
  }, [selectedCourse, trainingPlatformMarkupPct, trainingPlatformVatPct]);
  const isFreeBooking = chargeSarTotal <= 0;

  const priceInfo = useMemo(() => {
    if (!selectedCourse) return null;
    const markedBase = applyTrainingPlatformMarkupSar(Number(selectedCourse.price), trainingPlatformMarkupPct);
    return getCoursePriceInfo(TRAINING_PRICE_PLACEHOLDER_COURSE_ID, markedBase, 0, {
      vatPercent: trainingPlatformVatPct,
    });
  }, [selectedCourse, getCoursePriceInfo, trainingPlatformMarkupPct, trainingPlatformVatPct]);

  const durationMins = useMemo(
    () => (selectedCourse ? Math.round(Number(selectedCourse.duration_hours) * 60) : 0),
    [selectedCourse],
  );
  const sessionDurationLabel = useMemo(
    () => (selectedCourse ? durationBookingLabel(Number(selectedCourse.duration_hours), isRTL) : ''),
    [selectedCourse, isRTL],
  );

  useEffect(() => {
    if (!open || !user) return;
    const split = splitFullName(profile?.full_name?.trim() || '');
    setFirstName(split.firstName);
    setLastName(split.lastName);
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
    const fullName = joinFullName(firstName, lastName);
    if (!fullName || !phoneOut || !email.trim()) {
      toast.error(isRTL ? 'يرجى تعبئة الاسم والهاتف والبريد' : 'Please fill name, phone, and email');
      return;
    }

    /** Tap + edge always charge practical training in SAR (server-authoritative total). */
    const paymentCurrency = 'SAR';
    const paymentAmount = chargeSarTotal;

    const endTime = slotEndTimePg(selectedSlot, selectedCourse.duration_hours);

    const pendingPayload = {
      trainer_course_id: selectedCourse.id,
      trainer_id: selectedCourse.trainer_id,
      training_id: training.id,
      booking_date: dateStr,
      start_time: selectedSlot,
      end_time: endTime,
      notes: notes.trim(),
      full_name: fullName,
      phone: phoneOut,
      email: email.trim(),
      payment_amount: paymentAmount,
      payment_currency: paymentCurrency,
    };

    if (paymentAmount <= 0) {
      setPaying(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          toast.error(isRTL ? 'يرجى تسجيل الدخول' : 'Please sign in');
          return;
        }
        const inserted = await insertUserTrainingBooking({
          userId: session.user.id,
          pending: pendingPayload,
          paymentId: null,
          paymentStatus: 'paid',
          bookingStatus: 'confirmed',
        });
        if ('error' in inserted) {
          toast.error(inserted.error);
          return;
        }
        clearPendingTrainingBooking();
        onOpenChange(false);
        navigate(`/booking-success?id=${encodeURIComponent(inserted.id)}`);
      } finally {
        setPaying(false);
      }
      return;
    }

    writePendingTrainingBooking(pendingPayload);

    setPaying(true);
    try {
      const buildSubmit = (tokenId?: string) => ({
        paymentKind: 'training_booking' as const,
        trainerCourseId: selectedCourse.id,
        trainingId: training.id,
        currency: paymentCurrency,
        amount: paymentAmount,
        customerName: fullName,
        customerEmail: email.trim(),
        customerPhone: phoneOut,
        courseName: isRTL ? training.name_ar : training.name_en,
        isRTL,
        tokenId,
      });

      try {
        await tap.submitPayment(buildSubmit());
      } catch (err) {
        if (!(err instanceof RecoverableTapSourceUsedError)) throw err;
        await tap.submitPayment(buildSubmit());
      }
    } catch {
      setPaying(false);
    }
  };

  const isDateSelected = (d: Date) => selectedDate && format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  return (
    <>
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
                ) : !hasBookableSlotNext30Days ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground">
                      {isRTL ? 'لا توجد أوقات حجز متاحة خلال الـ30 يوماً القادمة' : 'No bookable times in the next 30 days'}
                    </p>
                    <p>
                      {isRTL
                        ? 'إن كان المدرب قد ضبط أوقاتاً رسمية: تأكد أن مدة الجلسة أقصر من أو تساوي نافذة التوفر، وأن التواريخ غير محظورة بالكامل، وأن المواعيد غير ممتلئة بالحجوزات.'
                        : 'If the trainer set weekly hours: ensure the session duration fits inside each window, dates are not all blocked, and slots are not already fully booked.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <FormField label={isRTL ? 'اليوم' : 'Day'}>
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                        {next30Days.map((date) => {
                          const ds = format(date, 'yyyy-MM-dd');
                          const enabled =
                            selectedCourse &&
                            dayHasFreeSlot(date, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, bookedSlots, weeklySlotRanges);
                          const preview = formatBookingTime(ds, '00:00', '00:00', isRTL);
                          const parts = preview.dateLine.split(isRTL ? '،' : ',');
                          const dow = parts[0]?.trim() || preview.dateLine;
                          const dm = (parts.slice(1).join(isRTL ? '،' : ',').trim() || preview.dateLine).replace(/\b\d{4}\b/g, '').trim();
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
                    </FormField>

                    <AnimatePresence>
                      {selectedDate && selectedCourse && (
                        <motion.div
                          key="slots"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-4"
                        >
                          {slotsForSelectedDay.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              {isRTL ? 'لا توجد أوقات في هذا اليوم.' : 'No slots on this day.'}
                            </p>
                          ) : (
                            <>
                              <div className="space-y-1">
                                <h4 className="font-semibold text-sm">
                                  {isRTL ? 'اختر وقت الجلسة' : 'Choose Session Time'}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {isRTL
                                    ? `مدة كل جلسة ${sessionDurationLabel} — اختر وقت البدء`
                                    : `Each session is ${sessionDurationLabel} — select a start time`}
                                </p>
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {slotsForSelectedDay.map((slot) => {
                                  const booked = slotBooked(dateStr, slot, bookedSlots);
                                  const selected = selectedSlot === slot;
                                  const startMin = pgTimeStringToMinutes(slot);
                                  const endMin = startMin + durationMins;
                                  const startTime = formatTimeFromMinutesSinceMidnight(startMin, isRTL);
                                  const endTime = formatTimeFromMinutesSinceMidnight(endMin, isRTL);
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      disabled={booked}
                                      onClick={() => {
                                        if (!booked) setSelectedSlot(slot);
                                      }}
                                      className={cn(
                                        'flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ease-out min-w-[100px] space-y-1',
                                        selected
                                          ? 'border-primary bg-primary/10 shadow-md scale-[1.02]'
                                          : booked
                                            ? 'border-border bg-muted/30 opacity-40 cursor-not-allowed'
                                            : 'border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer',
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'text-base font-bold tabular-nums',
                                          selected ? 'text-primary' : 'text-foreground',
                                        )}
                                        dir="ltr"
                                      >
                                        {startTime}
                                      </span>
                                      <span className="text-muted-foreground text-xs leading-none">↓</span>
                                      <span className="text-sm text-muted-foreground tabular-nums" dir="ltr">
                                        {endTime}
                                      </span>
                                      <div
                                        className={cn(
                                          'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full mt-1 font-medium',
                                          selected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                                        )}
                                      >
                                        <Clock className="w-2.5 h-2.5 shrink-0" aria-hidden />
                                        <span>{sessionDurationLabel}</span>
                                      </div>
                                      {booked ? (
                                        <span className="text-[10px] text-muted-foreground">{isRTL ? 'محجوز' : 'Booked'}</span>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedSlot !== null && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" aria-hidden />
                                  <div className="text-sm min-w-0">
                                    <span className="font-semibold text-primary">
                                      {isRTL ? 'الجلسة ستكون من' : 'Session will be from'}
                                    </span>
                                    <span className="mx-2 tabular-nums" dir="ltr">
                                      {formatTimeFromMinutesSinceMidnight(pgTimeStringToMinutes(selectedSlot), isRTL)} —{' '}
                                      {formatTimeFromMinutesSinceMidnight(pgTimeStringToMinutes(selectedSlot) + durationMins, isRTL)}
                                    </span>
                                    <span className="text-muted-foreground text-xs">({sessionDurationLabel})</span>
                                  </div>
                                </div>
                              )}
                            </>
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
                          <span className="text-muted-foreground">{isRTL ? 'الموعد' : 'Schedule'}</span>
                          <BookingTimeDisplay
                            date={dateStr}
                            startTime={selectedSlot}
                            endTime={slotEndTimePg(selectedSlot, selectedCourse.duration_hours)}
                            showCountdown
                            compact={false}
                          />
                        </div>
                        <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                          <span className="text-muted-foreground">{isRTL ? 'المدة' : 'Duration'}</span>
                          <span className="font-medium">{durationBookingLabel(selectedCourse.duration_hours, isRTL)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-x-3">
                          <span className="text-muted-foreground">{isRTL ? 'السعر' : 'Price'}</span>
                          <div className="space-y-1">
                            <span
                              className="font-semibold tabular-nums text-primary"
                              dir={isRTL ? 'rtl' : 'ltr'}
                              lang={isRTL ? 'ar' : 'en'}
                            >
                              {priceInfo ? formatPriceValueThenCurrencyName(priceInfo, isRTL) : ''}
                            </span>
                            {isFreeBooking ? (
                              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                {isRTL ? 'لا يلزم فتح صفحة الدفع.' : 'No payment page — confirm below.'}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label={t('fields.firstName.label')} required>
                    <Input
                      id="tbd-first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      placeholder={t('fields.firstName.placeholder')}
                    />
                  </FormField>
                  <FormField label={t('fields.lastName.label')} required>
                    <Input
                      id="tbd-last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      placeholder={t('fields.lastName.placeholder')}
                    />
                  </FormField>
                </div>
                <FormField
                  label={t('fields.phone.label')}
                  required
                >
                  <div className="flex gap-2 items-stretch" dir="ltr">
                    <span className="flex items-center rounded-md border border-input bg-muted/40 px-2.5 text-xs text-muted-foreground shrink-0">
                      +966
                    </span>
                    <Input
                      id="tbd-phone"
                      className="flex-1 min-w-0"
                      type="tel"
                      placeholder={t('fields.phone.placeholder')}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      autoComplete="tel"
                    />
                  </div>
                </FormField>
                <FormField label={t('fields.email.label')} dir="ltr" required>
                  <Input id="tbd-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" className="text-start" />
                </FormField>
                <FormField label={t('fields.notes.label')} hint={t('fields.notes.hint') || undefined}>
                  <Textarea id="tbd-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('fields.notes.placeholder')} />
                </FormField>

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
                    ) : isFreeBooking ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {isFreeBooking
                      ? isRTL
                        ? 'تأكيد الحجز (مجاني) →'
                        : 'Confirm free booking →'
                      : isRTL
                        ? 'تأكيد الحجز والدفع →'
                        : 'Confirm booking & pay →'}
                  </Button>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </DialogContent>
    </Dialog>
    {/* Inline 3DS modal — opens when Tap returns a redirect_url for card verification */}
    {tap.challengeUrl && (
      <Checkout3DSModal url={tap.challengeUrl} onCancel={tap.cancelChallenge} />
    )}
  </>
  );
};

export default TrainingBookingDialog;
