import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  addDays,
  startOfDay,
  isSameDay,
  isAfter,
  max,
  eachDayOfInterval,
  differenceInCalendarDays,
} from 'date-fns';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Check, ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type TrainingBookingTrainingMini = { id: string; name_ar: string; name_en: string };

export type TrainingBookingFlowProps = {
  training: TrainingBookingTrainingMini;
  selectedCourse: TrainerCourseRow;
  /** Path used after login (e.g. current booking URL) */
  loginReturnPath: string;
  onCancel: () => void;
};

const MAX_CUSTOM_RANGE_DAYS = 60;

function parseLocalDateYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return startOfDay(new Date());
  return startOfDay(new Date(y, m - 1, d));
}

function chunkDates(days: Date[], size: number): Date[][] {
  const out: Date[][] = [];
  for (let i = 0; i < days.length; i += size) out.push(days.slice(i, i + size));
  return out;
}

const PRESET_DIAL_CODES: { value: string; labelAr: string; labelEn: string }[] = [
  { value: '+966', labelAr: 'السعودية +966', labelEn: 'Saudi Arabia +966' },
  { value: '+971', labelAr: 'الإمارات +971', labelEn: 'UAE +971' },
  { value: '+965', labelAr: 'الكويت +965', labelEn: 'Kuwait +965' },
  { value: '+973', labelAr: 'البحرين +973', labelEn: 'Bahrain +973' },
  { value: '+974', labelAr: 'قطر +974', labelEn: 'Qatar +974' },
  { value: '+968', labelAr: 'عُمان +968', labelEn: 'Oman +968' },
  { value: '+962', labelAr: 'الأردن +962', labelEn: 'Jordan +962' },
  { value: '+970', labelAr: 'فلسطين +970', labelEn: 'Palestine +970' },
  { value: '+972', labelAr: 'إسرائيل +972', labelEn: 'Israel +972' },
  { value: '+20', labelAr: 'مصر +20', labelEn: 'Egypt +20' },
  { value: '+1', labelAr: 'أمريكا/كندا +1', labelEn: 'US/Canada +1' },
  { value: '+44', labelAr: 'المملكة المتحدة +44', labelEn: 'United Kingdom +44' },
  { value: '+90', labelAr: 'تركيا +90', labelEn: 'Turkey +90' },
];

const DIAL_DIGITS_SORTED = [...PRESET_DIAL_CODES]
  .map((p) => p.value.replace(/\D/g, ''))
  .sort((a, b) => b.length - a.length);

/** Parse stored profile / raw string into dial + national digits (no country digits in national) */
function parseProfilePhone(raw: string): { dial: string; national: string } {
  const t = raw.trim().replace(/[\s-]/g, '');
  if (!t) return { dial: '+966', national: '' };
  let work = t.replace(/[^\d+]/g, '');
  if (work.startsWith('00')) work = `+${work.slice(2)}`;
  if (!work.startsWith('+')) {
    const d = work.replace(/\D/g, '');
    if (d.startsWith('0')) return { dial: '+966', national: d.replace(/^0+/, '') };
    return { dial: '+966', national: d.replace(/^0+/, '') };
  }
  const digits = work.slice(1).replace(/\D/g, '');
  for (const code of DIAL_DIGITS_SORTED) {
    if (digits.startsWith(code)) {
      return { dial: `+${code}`, national: digits.slice(code.length).replace(/^0+/, '') };
    }
  }
  if (digits.length > 6) return { dial: '+966', national: digits.replace(/^0+/, '') };
  return { dial: '+966', national: '' };
}

function buildE164Phone(dialCode: string, nationalDigits: string): string | null {
  const dial = dialCode.trim();
  const n = nationalDigits.replace(/\D/g, '');
  if (!dial.startsWith('+') || !n) return null;
  const body = dial.slice(1).replace(/\D/g, '');
  if (!body) return null;
  return `+${body}${n}`;
}

function isPresetDial(dial: string): boolean {
  return PRESET_DIAL_CODES.some((p) => p.value === dial);
}

/** Spaces for readability; render inside dir="ltr" */
function formatE164ForDisplay(e164: string): string {
  const m = e164.match(/^\+(\d{1,4})(\d+)$/);
  if (!m) return e164;
  const [, cc, rest] = m;
  const chunks = rest.length > 0 ? rest.match(/.{1,3}/g) ?? [rest] : [];
  return `+${cc}${chunks.length ? ` ${chunks.join(' ')}` : ''}`;
}

const TrainingBookingFlow: React.FC<TrainingBookingFlowProps> = ({
  training,
  selectedCourse,
  loginReturnPath,
  onCancel,
}) => {
  const { isRTL, language } = useLanguage();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { getCoursePriceInfo, isSAR, exchangeRate, formatPriceValueThenCurrencyName } = useCurrency();
  const tap = useTapPayment();

  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phoneDialCode, setPhoneDialCode] = useState('+966');
  const [phoneNational, setPhoneNational] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [paying, setPaying] = useState(false);
  /** chunk index for preset (2×7) or custom bookable list (7 per page) */
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [rangeMode, setRangeMode] = useState<'preset14' | 'custom'>('preset14');
  const today = useMemo(() => startOfDay(new Date()), []);
  const [customDraftFrom, setCustomDraftFrom] = useState(() => format(today, 'yyyy-MM-dd'));
  const [customDraftTo, setCustomDraftTo] = useState(() => format(addDays(today, 13), 'yyyy-MM-dd'));
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ from: string; to: string } | null>(null);

  const trainerId = selectedCourse.trainer_id;
  const courseKey = selectedCourse.id;

  const bookingQueryBounds = useMemo(() => {
    if (rangeMode === 'custom' && appliedCustomRange) {
      const fromD = max([parseLocalDateYmd(appliedCustomRange.from), today]);
      const toD = max([parseLocalDateYmd(appliedCustomRange.to), fromD]);
      return { start: format(fromD, 'yyyy-MM-dd'), end: format(toD, 'yyyy-MM-dd') };
    }
    return {
      start: format(today, 'yyyy-MM-dd'),
      end: format(addDays(today, 24), 'yyyy-MM-dd'),
    };
  }, [rangeMode, appliedCustomRange, today]);

  const next14Days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);

  const availabilityQuery = useQuery({
    queryKey: ['trainer-availability-public', trainerId],
    enabled: !!trainerId,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_availability')
        .select('day_of_week, start_time, end_time, is_available')
        .eq('trainer_id', trainerId);
      if (error) throw error;
      return (data || []) as AvailRow[];
    },
  });
  const availability = availabilityQuery.data ?? [];

  const extrasQuery = useQuery({
    queryKey: ['trainer-booking-extras', trainerId],
    enabled: !!trainerId,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.from('trainers').select('*').eq('id', trainerId).maybeSingle();
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
    queryKey: ['training-bookings-slots', trainerId, bookingQueryBounds.start, bookingQueryBounds.end],
    enabled: !!trainerId,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_trainer_booked_slots', {
        p_trainer_id: trainerId,
        p_start_date: bookingQueryBounds.start,
        p_end_date: bookingQueryBounds.end,
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

  const fmtWeekRangeLabel = useCallback(
    (from: Date, to: Date) => {
      const loc = isRTL ? arSA : undefined;
      const sameMonth = format(from, 'yyyy-MM') === format(to, 'yyyy-MM');
      if (sameMonth) {
        return `${format(from, 'd', { locale: loc })}–${format(to, 'd MMMM yyyy', { locale: loc })}`;
      }
      return `${format(from, 'd MMM', { locale: loc })} – ${format(to, 'd MMM yyyy', { locale: loc })}`;
    },
    [isRTL],
  );

  const customBookableDays = useMemo(() => {
    if (rangeMode !== 'custom' || !appliedCustomRange) return null;
    const fromD = max([parseLocalDateYmd(appliedCustomRange.from), today]);
    const toD = max([parseLocalDateYmd(appliedCustomRange.to), fromD]);
    return eachDayOfInterval({ start: fromD, end: toD }).filter((d) =>
      dayHasFreeSlot(d, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, bookedSlots, weeklySlotRanges),
    );
  }, [
    rangeMode,
    appliedCustomRange,
    today,
    selectedCourse,
    availByDow,
    blockedDateSet,
    specialHoursByDate,
    bookedSlots,
    weeklySlotRanges,
  ]);

  const weekBlocks = useMemo(() => {
    const bookableIn = (days: Date[]) =>
      days.filter((d) =>
        dayHasFreeSlot(d, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, bookedSlots, weeklySlotRanges),
      ).length;

    if (rangeMode === 'custom') {
      if (!appliedCustomRange || !customBookableDays?.length) return [];
      const chunks = chunkDates(customBookableDays, 7);
      return chunks.map((days, index) => ({
        index,
        days,
        rangeLabel: fmtWeekRangeLabel(days[0], days[days.length - 1]),
        bookableCount: days.length,
      }));
    }

    const w1 = next14Days.slice(0, 7);
    const w2 = next14Days.slice(7, 14);
    return [
      { index: 0, days: w1, rangeLabel: fmtWeekRangeLabel(w1[0], w1[6]), bookableCount: bookableIn(w1) },
      { index: 1, days: w2, rangeLabel: fmtWeekRangeLabel(w2[0], w2[6]), bookableCount: bookableIn(w2) },
    ];
  }, [
    rangeMode,
    appliedCustomRange,
    customBookableDays,
    next14Days,
    selectedCourse,
    availByDow,
    blockedDateSet,
    specialHoursByDate,
    bookedSlots,
    weeklySlotRanges,
    fmtWeekRangeLabel,
  ]);

  const visibleDays = weekBlocks[activeWeekIndex]?.days ?? weekBlocks[0]?.days ?? [];
  const lastWeekIndex = Math.max(0, weekBlocks.length - 1);

  useEffect(() => {
    if (activeWeekIndex > lastWeekIndex) setActiveWeekIndex(0);
  }, [activeWeekIndex, lastWeekIndex]);

  const applyCustomRange = useCallback(() => {
    const from = parseLocalDateYmd(customDraftFrom);
    const to = parseLocalDateYmd(customDraftTo);
    if (isAfter(from, to)) {
      toast.error(isRTL ? 'تاريخ البداية يجب أن يكون قبل أو يساوي نهاية الفترة' : 'Start date must be on or before end date');
      return;
    }
    const fromClamped = max([from, today]);
    const toClamped = max([to, fromClamped]);
    const span = differenceInCalendarDays(toClamped, fromClamped) + 1;
    if (span > MAX_CUSTOM_RANGE_DAYS) {
      toast.error(
        isRTL
          ? `أقصى طول للفترة ${MAX_CUSTOM_RANGE_DAYS} يوماً`
          : `Maximum range is ${MAX_CUSTOM_RANGE_DAYS} days`,
      );
      return;
    }
    setAppliedCustomRange({
      from: format(fromClamped, 'yyyy-MM-dd'),
      to: format(toClamped, 'yyyy-MM-dd'),
    });
    setActiveWeekIndex(0);
    setSelectedDate(undefined);
    setSelectedSlot(null);
  }, [customDraftFrom, customDraftTo, today, isRTL]);

  const goWeek = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(lastWeekIndex, idx));
      const nextDays = weekBlocks[clamped]?.days ?? [];
      setActiveWeekIndex(clamped);
      setSelectedDate((cur) => {
        if (!cur) return undefined;
        return nextDays.some((d) => isSameDay(d, cur)) ? cur : undefined;
      });
    },
    [lastWeekIndex, weekBlocks],
  );

  /** Clear time when day cleared (e.g. switched to another week) */
  useEffect(() => {
    if (!selectedDate) setSelectedSlot(null);
  }, [selectedDate]);

  const slotsDataLoading =
    !!trainerId &&
    (availabilityQuery.isPending ||
      (availabilityQuery.isFetching && availability.length === 0) ||
      extrasQuery.isPending ||
      bookedSlotsQuery.isPending);

  const slotsScheduleError =
    !!trainerId && (availabilityQuery.isError || extrasQuery.isError || bookedSlotsQuery.isError);

  const presetHasBookableSlot = useMemo(() => {
    if (!selectedCourse || slotsDataLoading) return true;
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
    slotsDataLoading,
    availByDow,
    blockedDateSet,
    specialHoursByDate,
    bookedSlots,
    weeklySlotRanges,
  ]);

  const showNoAvailabilityCard = useMemo(() => {
    if (slotsDataLoading || slotsScheduleError || !selectedCourse) return false;
    if (rangeMode === 'preset14') return !presetHasBookableSlot;
    if (rangeMode === 'custom' && appliedCustomRange) return (customBookableDays?.length ?? 0) === 0;
    return false;
  }, [
    slotsDataLoading,
    slotsScheduleError,
    selectedCourse,
    rangeMode,
    presetHasBookableSlot,
    appliedCustomRange,
    customBookableDays,
  ]);

  const customNeedsApplyFirst = rangeMode === 'custom' && !appliedCustomRange;

  const slotsForSelectedDay = useMemo(() => {
    if (!selectedDate || !selectedCourse) return [];
    return getSlotsForDate(selectedDate, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges);
  }, [selectedDate, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges]);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  const trainerForDialog = selectedCourse.trainers;
  const trainerName = trainerForDialog ? (isRTL ? trainerForDialog.name_ar : trainerForDialog.name_en) : '';

  const calendarLocale = isRTL ? arSA : undefined;

  const priceInfo = useMemo(() => {
    return getCoursePriceInfo(TRAINING_PRICE_PLACEHOLDER_COURSE_ID, Number(selectedCourse.price), 0);
  }, [selectedCourse, getCoursePriceInfo]);

  const summaryPhoneE164 = useMemo(() => buildE164Phone(phoneDialCode, phoneNational), [phoneDialCode, phoneNational]);
  const summaryPhoneDisplay = useMemo(
    () => (summaryPhoneE164 ? formatE164ForDisplay(summaryPhoneE164) : ''),
    [summaryPhoneE164],
  );

  useEffect(() => {
    if (!user) return;
    setFullName(profile?.full_name?.trim() || '');
    const { dial, national } = parseProfilePhone(profile?.phone?.trim() || '');
    setPhoneDialCode(dial);
    setPhoneNational(national);
    setEmail((user.email ?? '').trim());
  }, [user, profile]);

  useEffect(() => {
    setStep('pick');
    setRangeMode('preset14');
    setAppliedCustomRange(null);
    const t = startOfDay(new Date());
    setCustomDraftFrom(format(t, 'yyyy-MM-dd'));
    setCustomDraftTo(format(addDays(t, 13), 'yyyy-MM-dd'));
    setActiveWeekIndex(0);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setNotes('');
    if (profile) {
      const { dial, national } = parseProfilePhone(String(profile?.phone ?? '').trim());
      setPhoneDialCode(dial);
      setPhoneNational(national);
    } else {
      setPhoneDialCode('+966');
      setPhoneNational('');
    }
    setEmail((user?.email ?? '').trim());
    setPaying(false);
    tap.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseKey]);

  useEffect(() => {
    if (tap.status !== 'failed') return;
    if (tap.error) toast.error(tap.error);
    setPaying(false);
  }, [tap.status, tap.error]);

  const goDetails = () => {
    if (!selectedDate || !selectedSlot) {
      toast.error(isRTL ? 'اختر اليوم والوقت' : 'Pick a day and time slot');
      return;
    }
    setStep('details');
  };

  const handlePay = async () => {
    if (!user || !selectedDate || !selectedSlot || !priceInfo) return;
    const phoneOut = buildE164Phone(phoneDialCode, phoneNational);
    const emailTrim = email.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
    if (!fullName.trim() || !phoneOut || !emailTrim) {
      toast.error(isRTL ? 'يرجى تعبئة الاسم والهاتف والبريد' : 'Please fill name, phone, and email');
      return;
    }
    if (!emailOk) {
      toast.error(isRTL ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Please enter a valid email address');
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
      email: emailTrim,
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
        customerEmail: emailTrim,
        customerPhone: phoneOut,
        courseName: isRTL ? training.name_ar : training.name_en,
        isRTL,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg) toast.error(msg);
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

  const loginHref = `/login?returnTo=${encodeURIComponent(loginReturnPath)}`;

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'} lang={language}>
      {/* Step indicator */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            'flex h-9 min-w-9 items-center justify-center rounded-full text-sm font-bold transition-colors',
            step === 'pick' ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary',
          )}
        >
          1
        </div>
        <div className={cn('h-0.5 flex-1 max-w-[120px] rounded-full', step === 'details' ? 'bg-primary' : 'bg-border')} />
        <div
          className={cn(
            'flex h-9 min-w-9 items-center justify-center rounded-full text-sm font-bold transition-colors',
            step === 'details' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          2
        </div>
        <span className="text-sm text-muted-foreground ms-1 hidden sm:inline">
          {step === 'pick'
            ? isRTL
              ? 'التاريخ والوقت'
              : 'Date & time'
            : isRTL
              ? 'البيانات والدفع'
              : 'Details & pay'}
        </span>
      </div>

      {authLoading ? (
        <div className="py-12 flex justify-center">
          <Skeleton className="h-12 w-full max-w-md rounded-xl" />
        </div>
      ) : !user ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-muted-foreground">{isRTL ? 'يرجى تسجيل الدخول لإتمام الحجز' : 'Please sign in to complete your booking'}</p>
            <Button asChild className="min-w-[200px]">
              <Link to={loginHref}>{isRTL ? 'تسجيل الدخول' : 'Sign in'}</Link>
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {isRTL ? 'العودة' : 'Go back'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {step === 'pick' ? (
            <motion.div
              key="pick"
              initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -10 : 10 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              {slotsDataLoading ? (
                <div className="space-y-4 py-1">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-36 w-full rounded-2xl" />
                </div>
              ) : slotsScheduleError ? (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-10 text-center text-sm leading-relaxed text-destructive">
                  {isRTL
                    ? 'تعذر تحميل جدول المواعيد. حدّث الصفحة أو حاول لاحقاً.'
                    : 'Could not load the schedule. Refresh the page or try again later.'}
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/50 bg-muted/15 p-1.5 sm:p-2">
                    <p className="text-xs font-medium text-muted-foreground px-2 pt-1 sm:pt-0 text-start">
                      {isRTL ? 'طريقة عرض المواعيد' : 'How do you want to browse dates?'}
                    </p>
                    <div className="flex rounded-xl bg-background/60 p-1 gap-1 border border-border/40">
                      <button
                        type="button"
                        onClick={() => {
                          setRangeMode('preset14');
                          setAppliedCustomRange(null);
                          setActiveWeekIndex(0);
                          setSelectedDate(undefined);
                          setSelectedSlot(null);
                        }}
                        className={cn(
                          'flex-1 rounded-lg py-2.5 px-3 text-sm font-semibold transition-all',
                          rangeMode === 'preset14' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {isRTL ? 'أسبوعان (افتراضي)' : 'Next 14 days'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRangeMode('custom');
                          setAppliedCustomRange(null);
                          setActiveWeekIndex(0);
                          setSelectedDate(undefined);
                          setSelectedSlot(null);
                        }}
                        className={cn(
                          'flex-1 rounded-lg py-2.5 px-3 text-sm font-semibold transition-all',
                          rangeMode === 'custom' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {isRTL ? 'فترة مخصصة' : 'Custom range'}
                      </button>
                    </div>
                  </div>

                  {rangeMode === 'custom' && (
                    <Card className="border-border/60 shadow-sm overflow-hidden">
                      <div className="h-0.5 w-full bg-gradient-to-r from-primary/40 via-primary/70 to-primary/30" />
                      <CardContent className="p-4 sm:p-5 space-y-4">
                        <div className="text-start space-y-1">
                          <Label className="text-sm font-semibold">{isRTL ? 'نطاق التواريخ' : 'Date range'}</Label>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {isRTL
                              ? `اختر من وإلى ثم اعرض الأيام التي يتوفر فيها المدرب فقط (حتى ${MAX_CUSTOM_RANGE_DAYS} يوماً).`
                              : `Pick from and to, then show only days the trainer is available (up to ${MAX_CUSTOM_RANGE_DAYS} days).`}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2 text-start">
                            <Label htmlFor="tbf-from">{isRTL ? 'من' : 'From'}</Label>
                            <Input
                              id="tbf-from"
                              type="date"
                              className="rounded-xl"
                              value={customDraftFrom}
                              min={format(today, 'yyyy-MM-dd')}
                              onChange={(e) => setCustomDraftFrom(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2 text-start">
                            <Label htmlFor="tbf-to">{isRTL ? 'إلى' : 'To'}</Label>
                            <Input
                              id="tbf-to"
                              type="date"
                              className="rounded-xl"
                              value={customDraftTo}
                              min={customDraftFrom || format(today, 'yyyy-MM-dd')}
                              max={format(addDays(parseLocalDateYmd(customDraftFrom || format(today, 'yyyy-MM-dd')), MAX_CUSTOM_RANGE_DAYS), 'yyyy-MM-dd')}
                              onChange={(e) => setCustomDraftTo(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button type="button" className="w-full sm:w-auto rounded-xl gap-2" onClick={() => applyCustomRange()}>
                          <CalendarRange className="h-4 w-4" />
                          {isRTL ? 'عرض الأيام المتاحة' : 'Show available days'}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {showNoAvailabilityCard && (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center text-sm leading-relaxed text-muted-foreground space-y-2">
                      <p className="font-semibold text-foreground">
                        {rangeMode === 'custom' && appliedCustomRange
                          ? isRTL
                            ? 'لا توجد أيام متاحة ضمن الفترة التي اخترتها'
                            : 'No trainer availability in the range you selected'
                          : isRTL
                            ? 'لا توجد أوقات حجز متاحة خلال الأيام الـ14 القادمة'
                            : 'No bookable times in the next 14 days'}
                      </p>
                      <p>
                        {rangeMode === 'custom' && appliedCustomRange
                          ? isRTL
                            ? 'جرّب توسيع الفترة أو اختيار تواريخ أخرى، ثم اضغط «عرض الأيام المتاحة» من جديد.'
                            : 'Try widening the range or other dates, then tap “Show available days” again.'
                          : isRTL
                            ? 'إن كان المدرب قد ضبط أوقاتاً رسمية: تأكد أن مدة الجلسة تناسب نافذة التوفر. يمكنك أيضاً تجربة «فترة مخصصة» أعلاه.'
                            : 'If the trainer set weekly hours, ensure the session duration fits each window. You can also try a custom date range above.'}
                      </p>
                    </div>
                  )}

                  {customNeedsApplyFirst && (
                    <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] px-5 py-8 text-center text-sm text-muted-foreground">
                      {isRTL
                        ? 'حدّد تاريخ البداية والنهاية، ثم اضغط «عرض الأيام المتاحة» لعرض الأيام التي يتوفر فيها المدرب فقط ضمن نطاقك.'
                        : 'Set your start and end dates, then tap “Show available days” to list only days the trainer is available within your range.'}
                    </div>
                  )}

                  {!showNoAvailabilityCard && !customNeedsApplyFirst && weekBlocks.length > 0 && (
                    <div className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5 shadow-sm space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <CalendarRange className="h-4 w-4" aria-hidden />
                          </div>
                          <div className="min-w-0 text-start space-y-1">
                            <Label className="text-sm font-semibold text-foreground">
                              {rangeMode === 'custom'
                                ? isRTL
                                  ? 'أيام متاحة في فترتك'
                                  : 'Available days in your range'
                                : isRTL
                                  ? 'اختر الأسبوع ثم اليوم'
                                  : 'Pick a week, then a day'}
                            </Label>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {rangeMode === 'custom'
                                ? isRTL
                                  ? 'يظهر هنا فقط ما يتوفر فيه المدرب. تنقّل بالمجموعات (حتى 7 أيام لكل مجموعة).'
                                  : 'Only days with open slots are listed. Use groups (up to 7 days each).'
                                : isRTL
                                  ? 'أسبوعان (14 يوماً). استخدم الفلتر أو الأسهم للتنقل بينهما.'
                                  : 'Two weeks (14 days). Use the filter or arrows to switch weeks.'}
                            </p>
                          </div>
                        </div>
                        <div className="w-full sm:w-[min(100%,280px)] shrink-0">
                          <Label className="sr-only">{isRTL ? 'فلتر المجموعة' : 'Group filter'}</Label>
                          <Select
                            value={weekBlocks.length ? String(activeWeekIndex) : undefined}
                            onValueChange={(v) => goWeek(Number(v))}
                            disabled={weekBlocks.length === 0}
                          >
                            <SelectTrigger className="rounded-xl h-11 bg-background/80">
                              <SelectValue placeholder={isRTL ? 'اختر مجموعة' : 'Pick a group'} />
                            </SelectTrigger>
                            <SelectContent>
                              {weekBlocks.map((w) => {
                                const presetTwo = rangeMode === 'preset14' && weekBlocks.length === 2;
                                const wk = presetTwo
                                  ? isRTL
                                    ? w.index === 0
                                      ? 'الأسبوع الأول'
                                      : 'الأسبوع الثاني'
                                    : w.index === 0
                                      ? 'Week 1'
                                      : 'Week 2'
                                  : isRTL
                                    ? `مجموعة ${w.index + 1}`
                                    : `Part ${w.index + 1}`;
                                const sub = isRTL
                                  ? `${w.rangeLabel} · ${w.bookableCount} أيام متاحة`
                                  : `${w.rangeLabel} · ${w.bookableCount} open days`;
                                return (
                                  <SelectItem key={w.index} value={String(w.index)} textValue={`${wk} ${sub}`}>
                                    <span className="block font-medium leading-tight">{wk}</span>
                                    <span className="block text-xs text-muted-foreground leading-snug">{sub}</span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className={cn('flex items-stretch gap-2', isRTL && 'flex-row-reverse')}>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-auto min-h-[44px] shrink-0 rounded-xl border-border/80"
                          disabled={activeWeekIndex <= 0}
                          onClick={() => goWeek(activeWeekIndex - 1)}
                          aria-label={isRTL ? 'المجموعة السابقة' : 'Previous group'}
                        >
                          {isRTL ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                        </Button>

                        <div className="hidden sm:flex flex-1 gap-2 min-w-0">
                          {weekBlocks.map((w) => {
                            const active = activeWeekIndex === w.index;
                            const presetTwo = rangeMode === 'preset14' && weekBlocks.length === 2;
                            const title = presetTwo
                              ? isRTL
                                ? w.index === 0
                                  ? 'الأسبوع 1'
                                  : 'الأسبوع 2'
                                : w.index === 0
                                  ? 'Week 1'
                                  : 'Week 2'
                              : isRTL
                                ? `مجموعة ${w.index + 1}`
                                : `Part ${w.index + 1}`;
                            return (
                              <button
                                key={w.index}
                                type="button"
                                onClick={() => goWeek(w.index)}
                                className={cn(
                                  'flex-1 rounded-xl border-2 px-3 py-2.5 text-start transition-all min-w-0',
                                  active
                                    ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                    : 'border-border/70 bg-background/80 hover:border-primary/35',
                                )}
                              >
                                <span className="block text-xs font-bold uppercase tracking-wide opacity-90">{title}</span>
                                <span
                                  className={cn(
                                    'mt-0.5 block text-[11px] leading-snug line-clamp-2',
                                    active ? 'text-primary-foreground/90' : 'text-muted-foreground',
                                  )}
                                >
                                  {w.rangeLabel}
                                </span>
                                <span
                                  className={cn(
                                    'mt-1 inline-block text-[10px] font-semibold tabular-nums',
                                    active ? 'text-primary-foreground/85' : 'text-primary',
                                  )}
                                >
                                  {w.bookableCount} {isRTL ? 'أيام متاحة' : 'open days'}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex flex-1 sm:hidden items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                          <p className="text-center text-xs font-medium text-muted-foreground">
                            {weekBlocks[activeWeekIndex]?.rangeLabel}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-auto min-h-[44px] shrink-0 rounded-xl border-border/80"
                          disabled={activeWeekIndex >= lastWeekIndex}
                          onClick={() => goWeek(activeWeekIndex + 1)}
                          aria-label={isRTL ? 'المجموعة التالية' : 'Next group'}
                        >
                          {isRTL ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </Button>
                      </div>

                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={activeWeekIndex}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="grid grid-cols-4 sm:grid-cols-7 gap-2"
                        >
                          {visibleDays.map((date) => {
                            const ds = format(date, 'yyyy-MM-dd');
                            const customApplied = rangeMode === 'custom' && !!appliedCustomRange;
                            const enabled =
                              customApplied ||
                              dayHasFreeSlot(
                                date,
                                selectedCourse,
                                availByDow,
                                blockedDateSet,
                                specialHoursByDate,
                                bookedSlots,
                                weeklySlotRanges,
                              );
                            const { dow, dm } = dayChipLabel(date);
                            const sel = isDateSelected(date);
                            return (
                              <button
                                key={ds}
                                type="button"
                                disabled={!enabled}
                                onClick={() => {
                                  if (!enabled) return;
                                  const wIdx = weekBlocks.findIndex((wb) => wb.days.some((day) => isSameDay(day, date)));
                                  if (wIdx >= 0) setActiveWeekIndex(wIdx);
                                  setSelectedDate(date);
                                  setSelectedSlot(null);
                                }}
                                className={cn(
                                  'flex flex-col items-center rounded-2xl border-2 px-1.5 py-2.5 sm:px-2 sm:py-3 transition-all min-h-[68px] sm:min-h-[76px]',
                                  sel && 'border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]',
                                  !enabled && 'opacity-35 cursor-not-allowed border-transparent bg-muted/30',
                                  enabled && !sel && 'hover:border-primary/40 cursor-pointer border-border/80 bg-background',
                                )}
                              >
                                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide opacity-90 text-center leading-tight">
                                  {dow}
                                </span>
                                <span className="text-sm sm:text-base font-black tabular-nums">{dm}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  )}

                  <AnimatePresence>
                    {selectedDate && (
                      <motion.div
                        key={`slots-${dateStr}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5 shadow-sm space-y-3"
                      >
                        <Label className="text-sm font-medium text-muted-foreground">{isRTL ? 'اختر وقت البدء' : 'Choose a start time'}</Label>
                        {slotsForSelectedDay.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">{isRTL ? 'لا توجد أوقات في هذا اليوم.' : 'No slots on this day.'}</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
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
                                    'rounded-xl border-2 p-3 text-center transition-all min-h-[76px] flex flex-col items-center justify-center gap-0.5',
                                    booked && 'opacity-40 cursor-not-allowed line-through border-transparent bg-muted/20',
                                    !booked && !selected && 'hover:border-primary/45 border-border/80 bg-background',
                                    !booked && selected && 'border-primary bg-primary text-primary-foreground shadow-md',
                                  )}
                                >
                                  <div className="font-bold tabular-nums text-sm">{formatTimeClockOnly(slot, isRTL)}</div>
                                  <div className="text-[10px] opacity-75">{slotPeriodLabel(slot, isRTL)}</div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pt-2', isRTL && 'sm:flex-row-reverse')}>
                    <Button type="button" variant="outline" onClick={onCancel} className="sm:min-w-[120px]">
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button type="button" className="gap-2 sm:min-w-[220px]" disabled={!selectedDate || !selectedSlot} onClick={() => goDetails()}>
                      {isRTL ? 'متابعة إلى الملخص' : 'Continue to summary'}
                      {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: isRTL ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 10 : -10 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              {trainerForDialog && selectedDate && selectedSlot && (
                <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/8 via-card to-card shadow-md">
                  <CardHeader className="space-y-1 pb-2 pt-5 border-b border-primary/10">
                    <CardTitle
                      className={cn(
                        'flex w-full items-center gap-2 text-lg',
                        isRTL ? 'flex-row-reverse justify-end text-left' : 'justify-start text-start',
                      )}
                    >
                      <Check className="h-5 w-5 shrink-0 text-primary" />
                      {isRTL ? 'ملخص الحجز' : 'Booking summary'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 py-5 text-sm">
                    {/* Physical LTR row: value flush left, label on the right — works in RTL & LTR pages */}
                    <div className="flex flex-col gap-3">
                      <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                        <span className="min-w-0 flex-1 text-left font-medium" dir="auto">
                          {trainerName}
                        </span>
                        <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                          {isRTL ? 'المدرب' : 'Trainer'}
                        </span>
                      </div>
                      <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                        <span className="min-w-0 flex-1 text-left font-medium" dir="auto">
                          {isRTL ? training.name_ar : training.name_en}
                        </span>
                        <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                          {isRTL ? 'التدريب' : 'Training'}
                        </span>
                      </div>
                      <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                        <span className="min-w-0 flex-1 text-left font-medium" dir="auto">
                          {format(selectedDate, isRTL ? 'EEEE، d MMMM yyyy' : 'EEEE, d MMMM yyyy', {
                            locale: calendarLocale,
                          })}
                        </span>
                        <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                          {isRTL ? 'التاريخ' : 'Date'}
                        </span>
                      </div>
                      <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                        <span className="min-w-0 flex-1 text-left font-medium tabular-nums" dir="ltr">
                          {formatTime12hClock(selectedSlot, isRTL)} — {formatTime12hClock(slotEndTimePg(selectedSlot, selectedCourse.duration_hours), isRTL)}
                        </span>
                        <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                          {isRTL ? 'الوقت' : 'Time'}
                        </span>
                      </div>
                      <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                        <span className="min-w-0 flex-1 text-left font-medium" dir="auto">
                          {durationBookingLabel(selectedCourse.duration_hours, isRTL)}
                        </span>
                        <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                          {isRTL ? 'المدة' : 'Duration'}
                        </span>
                      </div>
                      <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                        <div className="min-w-0 flex-1">
                          {summaryPhoneDisplay ? (
                            <span
                              className="block text-left font-medium tabular-nums break-all tracking-tight"
                              dir="ltr"
                              translate="no"
                            >
                              {summaryPhoneDisplay}
                            </span>
                          ) : (
                            <span className="block text-left text-sm italic text-muted-foreground" dir="auto">
                              {isRTL ? 'غير مُدخل — أضف الرقم في النموذج أدناه' : 'Not entered — add your number in the form below'}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                          {isRTL ? 'هاتفك' : 'Your phone'}
                        </span>
                      </div>
                      <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                        <div className="min-w-0 flex-1">
                          {email.trim() ? (
                            <span className="block text-left font-medium break-all" dir="ltr" translate="no">
                              {email.trim()}
                            </span>
                          ) : (
                            <span className="block text-left text-sm italic text-muted-foreground" dir="auto">
                              {isRTL ? 'غير مُدخل' : 'Not entered'}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                          {isRTL ? 'بريدك' : 'Your email'}
                        </span>
                      </div>
                      <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                        <span
                          className="min-w-0 flex-1 text-left text-base font-semibold tabular-nums text-primary"
                          dir={isRTL ? 'rtl' : 'ltr'}
                          lang={isRTL ? 'ar' : 'en'}
                        >
                          {formatPriceValueThenCurrencyName(priceInfo, isRTL)}
                        </span>
                        <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                          {isRTL ? 'السعر' : 'Price'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/70 shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{isRTL ? 'بياناتك' : 'Your details'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-start">
                    <Label htmlFor="tbf-full-name">{isRTL ? 'الاسم الكامل' : 'Full name'}</Label>
                    <Input
                      id="tbf-full-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      dir="auto"
                      className="rounded-xl text-start"
                    />
                  </div>
                  <div className="space-y-2 text-start">
                    <Label className="text-start">{isRTL ? 'الهاتف' : 'Phone'}</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2" dir="ltr">
                      <div className="w-full sm:w-[min(100%,240px)] shrink-0 space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground sr-only sm:not-sr-only block text-start">
                          {isRTL ? 'مقدمة الدولة' : 'Country code'}
                        </Label>
                        <Select
                          value={isPresetDial(phoneDialCode) ? phoneDialCode : 'custom'}
                          onValueChange={(v) => {
                            if (v === 'custom') {
                              setPhoneDialCode((cur) => (isPresetDial(cur) ? '+' : cur));
                              return;
                            }
                            setPhoneDialCode(v);
                          }}
                        >
                          <SelectTrigger id="tbf-dial" className="rounded-xl h-11 w-full bg-background text-start" dir="ltr">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRESET_DIAL_CODES.map((p) => (
                              <SelectItem key={p.value} value={p.value} textValue={isRTL ? p.labelAr : p.labelEn}>
                                <span className="text-start">{isRTL ? p.labelAr : p.labelEn}</span>
                              </SelectItem>
                            ))}
                            <SelectItem value="custom" textValue={isRTL ? 'مقدمة أخرى' : 'Other code'}>
                              {isRTL ? 'مقدمة أخرى (+…)' : 'Other (+…)'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {!isPresetDial(phoneDialCode) && (
                        <div className="w-full sm:max-w-[140px] shrink-0 space-y-1.5">
                          <Label htmlFor="tbf-dial-custom" className="text-[11px] text-muted-foreground block text-start">
                            {isRTL ? 'رمز الدولة' : 'Dial prefix'}
                          </Label>
                          <Input
                            id="tbf-dial-custom"
                            value={phoneDialCode}
                            onChange={(e) => {
                              let v = e.target.value.replace(/[^\d+]/g, '');
                              if (v === '') {
                                setPhoneDialCode('+');
                                return;
                              }
                              if (!v.startsWith('+')) v = `+${v.replace(/\+/g, '')}`;
                              setPhoneDialCode(v.slice(0, 10));
                            }}
                            placeholder="+352"
                            className="rounded-xl h-11 font-mono text-sm"
                            dir="ltr"
                            autoComplete="tel-country-code"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <Label htmlFor="tbf-phone-national" className="text-[11px] text-muted-foreground sr-only sm:not-sr-only block text-start">
                          {isRTL ? 'الرقم' : 'Number'}
                        </Label>
                        <Input
                          id="tbf-phone-national"
                          className="w-full min-w-0 rounded-xl h-11"
                          type="tel"
                          inputMode="numeric"
                          placeholder={isRTL ? 'رقم الجوال' : 'Mobile number'}
                          value={phoneNational}
                          onChange={(e) => setPhoneNational(e.target.value.replace(/\D/g, ''))}
                          autoComplete="tel-national"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {isRTL
                        ? 'اختر مقدمة الدولة أو أدخل رمزاً يبدأ بـ +، ثم الرقم بدون تكرار رمز الدولة.'
                        : 'Pick a country code or enter a custom prefix starting with +, then your national number (no duplicate country digits).'}
                    </p>
                  </div>
                  <div className="space-y-2 text-start">
                    <Label htmlFor="tbf-email">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
                    <Input
                      id="tbf-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      dir="ltr"
                      className="rounded-xl text-start"
                      placeholder={isRTL ? 'name@example.com' : 'name@example.com'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tbf-notes">{isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
                    <Textarea id="tbf-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl resize-none min-h-[88px]" />
                  </div>
                </CardContent>
              </Card>

              {priceInfo && (
                <div className="flex justify-between items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-5 py-4">
                  <span className="font-semibold">{isRTL ? 'الإجمالي' : 'Total'}</span>
                  <span dir={isRTL ? 'rtl' : 'ltr'} className="text-xl font-black tabular-nums text-primary" lang={isRTL ? 'ar' : 'en'}>
                    {formatPriceValueThenCurrencyName(priceInfo, isRTL)}
                  </span>
                </div>
              )}

              <div className={cn('flex flex-col-reverse sm:flex-row gap-2 pt-1', isRTL && 'sm:flex-row-reverse')}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto rounded-xl"
                  onClick={() => setStep('pick')}
                  disabled={paying || tap.status === 'processing'}
                >
                  {isRTL ? '← تغيير الموعد' : '← Change date & time'}
                </Button>
                <Button
                  type="button"
                  className="w-full sm:flex-1 gap-2 rounded-xl min-h-11"
                  onClick={() => void handlePay()}
                  disabled={paying || tap.status === 'processing'}
                >
                  {paying || tap.status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {isRTL ? 'تأكيد الحجز والدفع' : 'Confirm booking & pay'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default TrainingBookingFlow;
