import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  addDays,
  startOfDay,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency, TRAINING_PRICE_PLACEHOLDER_COURSE_ID } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useTapPayment } from '@/hooks/useTapPayment';
import { RecoverableTapSourceUsedError } from '@/services/payment.service';
import { writePendingTrainingBooking, clearPendingTrainingBooking, type PendingTrainingSessionSlot } from '@/lib/trainingBookingStorage';
import { sessionCountLabel } from '@/lib/trainingBookingSessions';
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
  formatTime12hClock,
  durationBookingLabel,
  isSlotTooSoon,
  dayHasFreeSlot,
} from '@/lib/trainingBookingUtils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Check, ChevronLeft, ChevronRight, X, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTrainingPlatformPricing } from '@/hooks/useTrainingPlatformPricing';
import { applyTrainingPlatformMarkupSar, trainingCustomerChargeTotalSar } from '@/lib/trainingPlatformMarkup';
import BookingTimeDisplay from '@/components/common/BookingTimeDisplay';
import { formatBookingTime, formatTimeFromMinutesSinceMidnight, pgTimeStringToMinutes } from '@/utils/formatDateTime';
import { joinFullName, splitFullName } from '@/lib/nameUtils';
import Checkout3DSModal from '@/components/checkout/Checkout3DSModal';

export type TrainingBookingTrainingMini = { id: string; name_ar: string; name_en: string };

export type TrainingBookingFlowProps = {
  training: TrainingBookingTrainingMini;
  selectedCourse: TrainerCourseRow;
  /** Parsed curriculum sessions from trainings.sessions JSONB — preferred over trainer_courses defaults */
  curriculumSessions?: { session_number: number; duration_hours: number }[];
  /** Path used after login (e.g. current booking URL) */
  loginReturnPath: string;
  onCancel: () => void;
};

type CommittedSessionPick = { date: string; start_time: string; end_time: string };

function parseLocalDateYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return startOfDay(new Date());
  return startOfDay(new Date(y, m - 1, d));
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
  curriculumSessions,
  loginReturnPath,
  onCancel,
}) => {
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { t } = useTranslation();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { getCoursePriceInfo, formatPriceValueThenCurrencyName } = useCurrency();
  const tap = useTapPayment();

  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const sessionsNeeded = useMemo(() => {
    if (curriculumSessions && curriculumSessions.length > 0) return curriculumSessions.length;
    const raw = Number(selectedCourse.sessions_count);
    const n = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
    return Math.max(1, n);
  }, [selectedCourse.sessions_count, curriculumSessions]);
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);
  const [sessionPicks, setSessionPicks] = useState<Array<CommittedSessionPick | null>>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneDialCode, setPhoneDialCode] = useState('+966');
  const [phoneNational, setPhoneNational] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [paying, setPaying] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), []);

  // Tick every minute so slots that cross the 24h threshold while the user is
  // on the page get re-evaluated and visually disabled without needing a refresh.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const trainerId = selectedCourse.trainer_id;
  const courseKey = selectedCourse.id;

  const bookingQueryBounds = useMemo(() => {
    return {
      start: format(today, 'yyyy-MM-dd'),
      end: format(addDays(today, 31), 'yyyy-MM-dd'),
    };
  }, [today]);

  const next30Days = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(today, i + 1)), [today]);

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
      const { data, error } = await supabase.from('public_trainers').select('id,name_ar,name_en,photo_url,bio_ar,bio_en,country,city,email,phone,bike_type,years_of_experience,services,status,profit_ratio,motorbike_brand,license_type,bike_photos,album_photos,bike_entries,availability_blocked_dates,availability_special_hours,availability_settings,language_levels,user_id,created_at').eq('id', trainerId).maybeSingle();
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

  const datesUsedByOtherSessions = useMemo(() => {
    if (sessionsNeeded <= 1) return new Set<string>();
    const s = new Set<string>();
    sessionPicks.forEach((p, i) => {
      if (i === activeSessionIndex) return;
      if (p?.date) s.add(p.date);
    });
    return s;
  }, [sessionPicks, activeSessionIndex, sessionsNeeded]);

  const combinedBookedSlots = useMemo(() => {
    if (sessionsNeeded <= 1) return bookedSlots;
    const virtual: BookedSlot[] = [];
    sessionPicks.forEach((p, i) => {
      if (i === activeSessionIndex || !p?.date || !p.start_time) return;
      virtual.push({ booking_date: p.date, start_time: p.start_time, status: 'confirmed' });
    });
    return [...bookedSlots, ...virtual];
  }, [bookedSlots, sessionPicks, activeSessionIndex, sessionsNeeded]);

  const availByDow = useMemo(() => buildAvailabilityByDow(availability), [availability]);

  useEffect(() => {
    if (activeSessionIndex >= sessionsNeeded) {
      setActiveSessionIndex(Math.max(0, sessionsNeeded - 1));
    }
  }, [activeSessionIndex, sessionsNeeded]);

  /** Clear time when day cleared */
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

  const hasBookableSlotNext30Days = useMemo(() => {
    if (!selectedCourse || slotsDataLoading) return true;
    return hasUnbookedSlotInRange(
      selectedCourse,
      availByDow,
      blockedDateSet,
      specialHoursByDate,
      combinedBookedSlots,
      31,
      weeklySlotRanges,
    );
  }, [
    selectedCourse,
    slotsDataLoading,
    availByDow,
    blockedDateSet,
    specialHoursByDate,
    combinedBookedSlots,
    weeklySlotRanges,
  ]);

  const showNoAvailabilityCard = useMemo(() => {
    if (slotsDataLoading || slotsScheduleError || !selectedCourse) return false;
    return !hasBookableSlotNext30Days;
  }, [slotsDataLoading, slotsScheduleError, selectedCourse, hasBookableSlotNext30Days]);

  const slotsForSelectedDay = useMemo(() => {
    if (!selectedDate || !selectedCourse) return [];
    return getSlotsForDate(selectedDate, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges);
  }, [selectedDate, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges]);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  const trainerForDialog = selectedCourse.trainers;
  const trainerName = trainerForDialog ? (isRTL ? trainerForDialog.name_ar : trainerForDialog.name_en) : '';

  const calendarLocale = isRTL ? ar : undefined;

  const { data: pricing } = useTrainingPlatformPricing();
  const trainingPlatformMarkupPct = pricing?.markupPercent ?? 0;
  const trainingPlatformVatPct = pricing?.vatPercent ?? 0;

  const priceInfo = useMemo(() => {
    const markedBase = applyTrainingPlatformMarkupSar(Number(selectedCourse.price), trainingPlatformMarkupPct);
    return getCoursePriceInfo(TRAINING_PRICE_PLACEHOLDER_COURSE_ID, markedBase, 0, {
      vatPercent: trainingPlatformVatPct,
    });
  }, [selectedCourse, getCoursePriceInfo, trainingPlatformMarkupPct, trainingPlatformVatPct]);

  const chargeSarTotal = useMemo(
    () =>
      trainingCustomerChargeTotalSar(
        Number(selectedCourse.price),
        trainingPlatformMarkupPct,
        trainingPlatformVatPct,
      ),
    [selectedCourse.price, trainingPlatformMarkupPct, trainingPlatformVatPct],
  );
  const isFreeBooking = chargeSarTotal <= 0;

  const perSessionDurationHours = useMemo(() => {
    if (curriculumSessions && curriculumSessions.length > 0) {
      const idx = Math.min(activeSessionIndex, curriculumSessions.length - 1);
      return curriculumSessions[idx].duration_hours;
    }
    return Number(selectedCourse.duration_hours);
  }, [selectedCourse.duration_hours, curriculumSessions, activeSessionIndex]);

  const durationMins = useMemo(
    () => Math.round(perSessionDurationHours * 60),
    [perSessionDurationHours],
  );
  const sessionDurationLabel = useMemo(
    () => durationBookingLabel(perSessionDurationHours, isRTL),
    [perSessionDurationHours, isRTL],
  );

  const summaryPhoneE164 = useMemo(() => buildE164Phone(phoneDialCode, phoneNational), [phoneDialCode, phoneNational]);
  const summaryPhoneDisplay = useMemo(
    () => (summaryPhoneE164 ? formatE164ForDisplay(summaryPhoneE164) : ''),
    [summaryPhoneE164],
  );

  useEffect(() => {
    if (!user) return;
    const split = splitFullName(profile?.full_name?.trim() || '');
    setFirstName(split.firstName);
    setLastName(split.lastName);
    const { dial, national } = parseProfilePhone(profile?.phone?.trim() || '');
    setPhoneDialCode(dial);
    setPhoneNational(national);
    setEmail((user.email ?? '').trim());
  }, [user, profile]);

  useEffect(() => {
    setStep('pick');
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setActiveSessionIndex(0);
    setSessionPicks(Array.from({ length: sessionsNeeded }, () => null));
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
    // Only reset when switching trainer/course — not when sessionsNeeded stabilizes (avoids wiping multi-session progress).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseKey]);

  /** When sessions_count loads (1→N) without course change, grow the picks array without wiping progress. */
  useEffect(() => {
    setSessionPicks((prev) => {
      if (prev.length >= sessionsNeeded) return prev;
      const next = [...prev];
      while (next.length < sessionsNeeded) next.push(null);
      return next;
    });
  }, [sessionsNeeded, courseKey]);

  /** Load committed pick when switching session (Back/Next/Edit). Do not list `sessionPicks` as a dependency:
   *  updates to picks would re-run and clear the user's in-progress day/time for the current session. */
  useEffect(() => {
    if (sessionsNeeded <= 1 || step !== 'pick') return;
    const p = sessionPicks[activeSessionIndex];
    if (p?.date) {
      setSelectedDate(parseLocalDateYmd(p.date));
      setSelectedSlot(p.start_time);
    } else {
      setSelectedDate(undefined);
      setSelectedSlot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync only on navigation / course / step
  }, [activeSessionIndex, sessionsNeeded, courseKey, step]);

  useEffect(() => {
    if (tap.status !== 'failed') return;
    if (tap.error) toast.error(tap.error);
    setPaying(false);
  }, [tap.status, tap.error]);

  const multiSchedulingComplete = useMemo(() => {
    if (sessionsNeeded <= 1) return true;
    for (let i = 0; i < sessionsNeeded; i++) {
      const p = sessionPicks[i];
      if (p?.date && p?.start_time) continue;
      if (i === activeSessionIndex && selectedDate && selectedSlot) continue;
      return false;
    }
    return true;
  }, [sessionsNeeded, sessionPicks, activeSessionIndex, selectedDate, selectedSlot]);

  const detailSummaryPicks = useMemo(() => {
    if (sessionsNeeded <= 1) return null;
    if (sessionPicks.length < sessionsNeeded) return null;
    const slice = sessionPicks.slice(0, sessionsNeeded);
    if (!slice.every(Boolean)) return null;
    return slice as CommittedSessionPick[];
  }, [sessionsNeeded, sessionPicks]);

  const showBookingSummaryCard =
    !!trainerForDialog && (sessionsNeeded > 1 ? !!detailSummaryPicks : !!(selectedDate && selectedSlot));

  const goDetails = () => {
    if (sessionsNeeded > 1) {
      const padded = [...sessionPicks];
      while (padded.length < sessionsNeeded) padded.push(null);
      const merged: Array<CommittedSessionPick | null> = padded.map((p, i) => {
        if (p) return p;
        if (i === activeSessionIndex && selectedDate && selectedSlot) {
          return {
            date: format(selectedDate, 'yyyy-MM-dd'),
            start_time: selectedSlot,
            end_time: slotEndTimePg(selectedSlot, perSessionDurationHours),
          };
        }
        return null;
      });
      if (!merged.every(Boolean)) {
        toast.error(isRTL ? 'أكمل جدولة جميع الجلسات' : 'Schedule every session to continue');
        return;
      }
      setSessionPicks(merged as CommittedSessionPick[]);
      setStep('details');
      return;
    }
    if (!selectedDate || !selectedSlot) {
      toast.error(isRTL ? 'اختر اليوم والوقت' : 'Pick a day and time slot');
      return;
    }
    setStep('details');
  };

  const handleNextSession = () => {
    if (!selectedDate || !selectedSlot) {
      toast.error(isRTL ? 'اختر اليوم والوقت' : 'Pick a day and time slot');
      return;
    }
    const ds = format(selectedDate, 'yyyy-MM-dd');
    const endT = slotEndTimePg(selectedSlot, perSessionDurationHours);
    const nextIdx = Math.min(activeSessionIndex + 1, sessionsNeeded - 1);
    setSessionPicks((prev) => {
      const c = [...prev];
      while (c.length < sessionsNeeded) c.push(null);
      c[activeSessionIndex] = { date: ds, start_time: selectedSlot, end_time: endT };
      return c;
    });
    if (activeSessionIndex < sessionsNeeded - 1) setActiveSessionIndex(nextIdx);
    const nextPick = sessionPicks[nextIdx];
    if (activeSessionIndex < sessionsNeeded - 1 && nextPick?.date) {
      setSelectedDate(parseLocalDateYmd(nextPick.date));
      setSelectedSlot(nextPick.start_time);
    } else if (activeSessionIndex < sessionsNeeded - 1) {
      setSelectedDate(undefined);
      setSelectedSlot(null);
    }
  };

  const clearSession = (index: number) => {
    setSessionPicks((prev) => {
      const c = [...prev];
      if (index < c.length) c[index] = null;
      return c;
    });
    if (index === activeSessionIndex) {
      setSelectedDate(undefined);
      setSelectedSlot(null);
    } else if (index < activeSessionIndex) {
      setActiveSessionIndex(index);
      setSelectedDate(undefined);
      setSelectedSlot(null);
    }
  };

  const handlePrevSession = () => {
    if (activeSessionIndex <= 0) return;
    setActiveSessionIndex((i) => i - 1);
  };

  const handlePay = async () => {
    const picksReady =
      sessionsNeeded > 1
        ? sessionPicks.length >= sessionsNeeded && sessionPicks.every(Boolean)
        : !!(selectedDate && selectedSlot);
    if (!user || !picksReady || !priceInfo) return;
    const phoneOut = buildE164Phone(phoneDialCode, phoneNational);
    const emailTrim = email.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
    const fullName = joinFullName(firstName, lastName);
    if (!fullName || !phoneOut || !emailTrim) {
      toast.error(isRTL ? 'يرجى تعبئة الاسم والهاتف والبريد' : 'Please fill name, phone, and email');
      return;
    }
    if (!emailOk) {
      toast.error(isRTL ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Please enter a valid email address');
      return;
    }

    const allPicks =
      sessionsNeeded > 1
        ? (sessionPicks as CommittedSessionPick[])
        : [{ date: dateStr, start_time: selectedSlot! }];
    const tooSoonSession = allPicks.find((p) => isSlotTooSoon(p.date, p.start_time));
    if (tooSoonSession) {
      toast.error(
        isRTL
          ? 'يجب أن يكون موعد الجلسة بعد 24 ساعة على الأقل من الآن'
          : 'Session must be at least 24 hours from now',
      );
      return;
    }

    const paymentCurrency = 'SAR';
    const paymentAmount = chargeSarTotal;

    const picks = sessionsNeeded > 1 ? (sessionPicks as CommittedSessionPick[]) : null;
    const firstDateStr = picks ? picks[0].date : dateStr;
    const firstStart = picks ? picks[0].start_time : selectedSlot!;
    const firstEnd = picks ? picks[0].end_time : slotEndTimePg(selectedSlot!, perSessionDurationHours);
    const sessionsDetail: PendingTrainingSessionSlot[] | undefined =
      picks && picks.length > 1
        ? picks.map((p) => ({ date: p.date, start_time: p.start_time, end_time: p.end_time }))
        : undefined;

    const pendingPayload = {
      trainer_course_id: selectedCourse.id,
      trainer_id: selectedCourse.trainer_id,
      training_id: training.id,
      booking_date: firstDateStr,
      start_time: firstStart,
      end_time: firstEnd,
      ...(sessionsDetail && sessionsDetail.length > 1 ? { sessions: sessionsDetail } : {}),
      notes: notes.trim(),
      full_name: fullName,
      phone: phoneOut,
      email: emailTrim,
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
        customerEmail: emailTrim,
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg) toast.error(msg);
      setPaying(false);
    }
  };

  const canSelectDate = useCallback(
    (dateValue: string, sessionIndex: number) => {
      const dateObj = parseLocalDateYmd(dateValue);
      const dayOfWeek = dateObj.getDay();
      const hasSchedule = availability.some((a) => Number(a.day_of_week) === dayOfWeek && a.is_available);
      if (!hasSchedule) return false;
      const dayFree = dayHasFreeSlot(
        dateObj,
        selectedCourse,
        availByDow,
        blockedDateSet,
        specialHoursByDate,
        combinedBookedSlots,
        weeklySlotRanges,
      );
      if (!dayFree) return false;

      const allSlots = getSlotsForDate(dateObj, selectedCourse, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges);
      const hasBookableSlot = allSlots.some(
        (s) => !isSlotTooSoon(dateValue, s) && !slotBooked(dateValue, s, combinedBookedSlots),
      );
      if (!hasBookableSlot) return false;

      if (sessionPicks.some((s, i) => i !== sessionIndex && s?.date === dateValue)) return false;
      if (sessionIndex > 0) {
        const prevDate = sessionPicks[sessionIndex - 1]?.date;
        if (prevDate && dateValue <= prevDate) return false;
      }
      return true;
    },
    [
      availability,
      selectedCourse,
      availByDow,
      blockedDateSet,
      specialHoursByDate,
      combinedBookedSlots,
      weeklySlotRanges,
      sessionPicks,
    ],
  );

  const isSlotChronological = useCallback(
    (slotStart: string) => {
      if (activeSessionIndex <= 0 || !selectedDate) return true;
      const prev = sessionPicks[activeSessionIndex - 1];
      if (!prev?.date || !prev?.end_time) return true;
      const prevEnd = new Date(`${prev.date}T${prev.end_time}`);
      const candidate = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${slotStart}`);
      return candidate.getTime() > prevEnd.getTime();
    },
    [activeSessionIndex, selectedDate, sessionPicks],
  );

  const dayChipLabel = useCallback(
    (dateValue: string) => {
      const view = formatBookingTime(dateValue, '00:00', '00:00', isRTL);
      const parts = view.dateLine.split(isRTL ? '،' : ',');
      const dayLine = parts[0]?.trim() || view.dateLine;
      const dateLine = (parts.slice(1).join(isRTL ? '،' : ',').trim() || view.dateLine).replace(/\b\d{4}\b/g, '').trim();
      return { dayLine, dateLine, countdown: view.countdown, countdownColor: view.countdownColor };
    },
    [isRTL],
  );

  const isDateSelected = (d: Date) => selectedDate && format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  const loginHref = `/login?returnTo=${encodeURIComponent(loginReturnPath)}`;

  return (
    <>
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
            : isFreeBooking
              ? isRTL
                ? 'البيانات وتأكيد الحجز'
                : 'Details & confirm'
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
                  {sessionsNeeded > 1 ? (
                      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5 space-y-4">
                        <div className="text-start space-y-1">
                          <p className="text-base font-bold text-foreground">
                            {isRTL ? 'اختر مواعيد جلساتك' : 'Select your session times'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isRTL ? 'اختر يوماً ووقتاً لكل جلسة على حدة.' : 'Pick a separate day and time for each session.'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          <span className="text-muted-foreground">
                            {isRTL
                              ? `الجلسة ${activeSessionIndex + 1} من ${sessionsNeeded}`
                              : `Session ${activeSessionIndex + 1} of ${sessionsNeeded}`}
                          </span>
                          <div className="flex flex-1 min-w-0 items-center gap-1.5 justify-center sm:justify-start">
                            {Array.from({ length: sessionsNeeded }, (_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'h-2 flex-1 max-w-10 rounded-full transition-colors',
                                  i < activeSessionIndex ? 'bg-primary' : i === activeSessionIndex ? 'bg-primary/50' : 'bg-border',
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {Array.from({ length: sessionsNeeded }, (_, i) => {
                            const p = sessionPicks[i];
                            const done = !!(p?.date && p?.start_time);
                            const active = i === activeSessionIndex;
                            return (
                              <div
                                key={i}
                                className={cn(
                                  'flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                                  active ? 'border-primary bg-background shadow-sm' : 'border-border/70 bg-muted/20 opacity-80',
                                )}
                              >
                                <span className="font-semibold text-primary tabular-nums">
                                  {isRTL ? `الجلسة ${i + 1}` : `Session ${i + 1}`}
                                </span>
                                {done ? (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <BookingTimeDisplay
                                      date={p!.date}
                                      startTime={p!.start_time || '00:00'}
                                      endTime={p!.end_time || '00:00'}
                                      compact
                                      showCountdown
                                    />
                                    <button
                                      type="button"
                                      onClick={() => clearSession(i)}
                                      className="ms-auto text-muted-foreground hover:text-destructive"
                                      aria-label={isRTL ? `مسح الجلسة ${i + 1}` : `Clear session ${i + 1}`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : active ? (
                                  <span className="text-muted-foreground text-xs">
                                    {isRTL ? 'اختر اليوم والوقت أدناه' : 'Choose day & time below'}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">
                                    {isRTL ? 'لم يتم التحديد بعد' : 'Not scheduled yet'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={activeSessionIndex}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="text-start border-t border-border/50 pt-3"
                          >
                            <p className="text-sm font-semibold">
                              {isRTL
                                ? `الجلسة ${activeSessionIndex + 1} — اختر اليوم والوقت`
                                : `Session ${activeSessionIndex + 1} — pick day & time`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isRTL ? 'الأيام المتاحة:' : 'Available days:'}
                            </p>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                  ) : null}

                  {showNoAvailabilityCard && (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center text-sm leading-relaxed text-muted-foreground space-y-2">
                      <p className="font-semibold text-foreground">
                        {isRTL ? 'لا توجد أوقات حجز متاحة خلال الـ30 يوماً القادمة' : 'No bookable times in the next 30 days'}
                      </p>
                      <p>
                        {isRTL
                          ? 'تأكد أن المدرب لديه أوقات متاحة وأن مدة الجلسة تناسب نافذة التوفر.'
                          : 'Ensure the trainer has open schedule windows and your session duration fits them.'}
                      </p>
                    </div>
                  )}

                  {!showNoAvailabilityCard && (
                    <div className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5 shadow-sm space-y-4">
                      <div className="text-start space-y-1">
                        <Label className="text-sm font-semibold text-foreground">
                          {isRTL ? 'اختر يوم الجلسة (30 يوماً قادمة)' : 'Pick a session day (next 30 days)'}
                        </Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {isRTL
                            ? 'لا يمكن اختيار يوم محجوز لجلسة أخرى، ويجب أن تكون كل جلسة بعد الجلسة السابقة.'
                            : 'A day already used by another session is blocked, and each session must be after the previous one.'}
                        </p>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                        {next30Days.map((date) => {
                          const ds = format(date, 'yyyy-MM-dd');
                          const usedByOtherSession = datesUsedByOtherSessions.has(ds);
                          const enabled = canSelectDate(ds, activeSessionIndex);
                          const { dayLine, dateLine, countdown, countdownColor } = dayChipLabel(ds);
                          const sel = isDateSelected(date);
                          return (
                            <button
                              key={ds}
                              type="button"
                              disabled={!enabled}
                              title={
                                usedByOtherSession
                                  ? isRTL
                                    ? 'لقد حجزت جلسة في هذا اليوم'
                                    : 'You already have a session on this day'
                                  : undefined
                              }
                              onClick={() => {
                                if (!enabled) return;
                                setSelectedDate(date);
                                setSelectedSlot(null);
                              }}
                              className={cn(
                                'flex shrink-0 min-w-[130px] flex-col items-start gap-1.5 rounded-xl border p-3 text-start transition-colors',
                                sel && 'bg-primary text-primary-foreground border-primary',
                                !enabled && 'opacity-40 cursor-not-allowed bg-muted/30 border-border/40',
                                enabled && !sel && 'hover:border-primary/50 cursor-pointer border-border bg-card',
                              )}
                            >
                              <span className="text-xs font-semibold">{dayLine}</span>
                              <span className="text-sm font-bold">{dateLine}</span>
                              {countdown && countdownColor ? (
                                <span
                                  className={cn(
                                    'mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                    countdownColor === 'green' && 'bg-green-500/10 text-green-600 border-green-500/20',
                                    countdownColor === 'amber' && 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                                    countdownColor === 'red' && 'bg-red-500/10 text-red-600 border-red-500/20',
                                  )}
                                >
                                  {countdown}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 px-1">
                        {isRTL
                          ? 'يجب الحجز قبل 24 ساعة على الأقل من موعد الجلسة'
                          : 'Booking must be made at least 24 hours before the session'}
                      </p>
                      {activeSessionIndex > 0 && sessionPicks[activeSessionIndex - 1] && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 px-1">
                          <span>
                            {isRTL
                              ? `الجلسة ${activeSessionIndex + 1} يجب أن تكون بعد`
                              : `Session ${activeSessionIndex + 1} must be after`}
                          </span>
                          <BookingTimeDisplay
                            date={sessionPicks[activeSessionIndex - 1]!.date}
                            startTime={sessionPicks[activeSessionIndex - 1]!.start_time}
                            endTime={sessionPicks[activeSessionIndex - 1]!.end_time}
                            compact
                            showCountdown={false}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <AnimatePresence>
                    {selectedDate && (
                      <motion.div
                        key={`slots-${sessionsNeeded > 1 ? `${activeSessionIndex}-` : ''}${dateStr}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5 shadow-sm space-y-3"
                      >
                        {slotsForSelectedDay.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">{isRTL ? 'لا توجد أوقات في هذا اليوم.' : 'No slots on this day.'}</p>
                        ) : (
                          <>
                            <div className="space-y-1 mb-4">
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
                                const booked = slotBooked(dateStr, slot, combinedBookedSlots);
                                const tooSoon = isSlotTooSoon(dateStr, slot);
                                const chronologicalOk = isSlotChronological(slot);
                                const selected = selectedSlot === slot;
                                const startMin = pgTimeStringToMinutes(slot);
                                const endMin = startMin + durationMins;
                                const startTime = formatTimeFromMinutesSinceMidnight(startMin, isRTL);
                                const endTime = formatTimeFromMinutesSinceMidnight(endMin, isRTL);
                                const disabled = booked || tooSoon || !chronologicalOk;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    disabled={disabled}
                                    aria-disabled={disabled}
                                    onClick={() => {
                                      if (disabled) return;
                                      // Defensive re-check at click time: if the slot has crossed
                                      // the 24h threshold between render and click, refuse silently
                                      // and surface a toast so the UI stays trustworthy.
                                      if (isSlotTooSoon(dateStr, slot)) {
                                        toast.error(
                                          isRTL
                                            ? 'يجب الحجز قبل 24 ساعة على الأقل من موعد الجلسة'
                                            : 'You must book at least 24 hours before the session',
                                        );
                                        return;
                                      }
                                      setSelectedSlot(slot);
                                    }}
                                    title={
                                      tooSoon
                                        ? isRTL
                                          ? 'يجب الحجز قبل 24 ساعة على الأقل'
                                          : 'Must book at least 24 hours ahead'
                                        : !chronologicalOk
                                          ? isRTL
                                            ? 'الوقت يجب أن يكون بعد نهاية الجلسة السابقة'
                                            : 'Time must be after the previous session'
                                          : undefined
                                    }
                                    className={cn(
                                      'flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ease-out min-w-[100px] space-y-1',
                                      selected
                                        ? 'border-primary bg-primary/10 shadow-md scale-[1.02]'
                                        : disabled
                                          ? 'border-border bg-muted/30 opacity-40 cursor-not-allowed pointer-events-none'
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
                                    ) : tooSoon ? (
                                      <span className="text-[10px] text-amber-600">&lt; 24h</span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                            {selectedSlot !== null && (
                              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 mt-4">
                                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" aria-hidden />
                                <div className="text-sm min-w-0">
                                  <span className="font-semibold text-primary">
                                    {isRTL ? 'الجلسة ستكون من' : 'Session will be from'}
                                  </span>
                                  <span className="mx-2 tabular-nums" dir="ltr">
                                    {(() => {
                                      const startRaw = formatTimeFromMinutesSinceMidnight(
                                        pgTimeStringToMinutes(selectedSlot),
                                        isRTL,
                                      );
                                      const endRaw = formatTimeFromMinutesSinceMidnight(
                                        pgTimeStringToMinutes(selectedSlot) + durationMins,
                                        isRTL,
                                      );
                                      if (!isRTL) return `${startRaw} — ${endRaw}`;

                                      // `formatTimeFromMinutesSinceMidnight` renders `11:00 ص` / `1:00 م`.
                                      // We want `11ص` / `1م` (no `:00` or extra space).
                                      const toShort = (v: string) => v.replace(/^(\d{1,2}):00\s*([صم])$/u, "$1$2");
                                      return `من ${toShort(startRaw)} الى ${toShort(endRaw)}`;
                                    })()}
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

                  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center pt-2', isRTL && 'sm:flex-row-reverse')}>
                    <Button type="button" variant="outline" onClick={onCancel} className="sm:min-w-[120px]">
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end', isRTL && 'sm:flex-row-reverse')}>
                      {sessionsNeeded > 1 && activeSessionIndex > 0 ? (
                        <Button type="button" variant="outline" className="gap-1 sm:min-w-[120px]" onClick={() => handlePrevSession()}>
                          {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                          {isRTL ? 'السابق' : 'Back'}
                        </Button>
                      ) : null}
                      {sessionsNeeded > 1 && activeSessionIndex < sessionsNeeded - 1 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="gap-2 sm:min-w-[200px]"
                          disabled={!selectedDate || !selectedSlot}
                          onClick={() => handleNextSession()}
                        >
                          {isRTL ? (
                            <>
                              التالي: الجلسة {activeSessionIndex + 2}
                              <ChevronLeft className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Next: Session {activeSessionIndex + 2}
                              <ChevronRight className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        className="gap-2 sm:min-w-[220px]"
                        disabled={sessionsNeeded > 1 ? !multiSchedulingComplete : !selectedDate || !selectedSlot}
                        onClick={() => goDetails()}
                      >
                        {isRTL ? 'متابعة إلى الملخص' : 'Continue to summary'}
                        {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </div>
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
              {showBookingSummaryCard && (
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
                      {detailSummaryPicks ? (
                        <>
                          <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                            <span className="min-w-0 flex-1 text-left font-medium" dir="auto">
                              {sessionCountLabel(sessionsNeeded, isRTL)}
                            </span>
                            <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                              {isRTL ? 'عدد الجلسات' : 'Sessions'}
                            </span>
                          </div>
                          <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                            <span className="min-w-0 flex-1 text-left font-medium" dir="auto">
                              {durationBookingLabel(
                                curriculumSessions && curriculumSessions.length > 0
                                  ? curriculumSessions.reduce((sum, s) => sum + s.duration_hours, 0)
                                  : Number(selectedCourse.duration_hours) * sessionsNeeded,
                                isRTL,
                              )}
                            </span>
                            <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                              {isRTL ? 'المدة الكلية' : 'Total duration'}
                            </span>
                          </div>
                          <Separator className="my-1" />
                          <p className="text-xs font-semibold text-muted-foreground text-start">
                            {isRTL ? 'الجلسات المحددة' : 'Scheduled sessions'}
                          </p>
                          <div className="flex flex-col gap-1 rounded-xl border border-border/40 overflow-hidden">
                            {detailSummaryPicks.map((p, idx) => (
                              <div
                                key={`${p.date}-${p.start_time}-${idx}`}
                                className={cn(
                                  'flex flex-wrap items-center gap-2 py-3 px-3 border-b border-border/40 last:border-0',
                                  idx % 2 === 1 ? 'bg-muted/25' : 'bg-muted/10',
                                )}
                              >
                                <span className="font-semibold text-primary shrink-0">
                                  {isRTL ? `الجلسة ${idx + 1}` : `Session ${idx + 1}`}
                                </span>
                                <span className="text-muted-foreground">·</span>
                                <BookingTimeDisplay date={p.date} startTime={p.start_time} endTime={p.end_time} showCountdown compact />
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                            <span className="min-w-0 flex-1 text-left font-medium" dir="auto">
                              {selectedDate &&
                                format(selectedDate, isRTL ? 'EEEE، d MMMM yyyy' : 'EEEE, d MMMM yyyy', {
                                  locale: calendarLocale,
                                })}
                            </span>
                            <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                              {isRTL ? 'التاريخ' : 'Date'}
                            </span>
                          </div>
                          <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                            <span className="min-w-0 flex-1 text-left font-medium tabular-nums" dir="ltr">
                              {selectedSlot &&
                                (() => {
                                  const startRaw = formatTime12hClock(selectedSlot, isRTL);
                                  const endRaw = formatTime12hClock(
                                    slotEndTimePg(selectedSlot, perSessionDurationHours),
                                    isRTL,
                                  );

                                  if (!isRTL) return `${startRaw} — ${endRaw}`;

                                  // Example target: `1:00 ص` → `1ص`, `3:00 م` → `3م`
                                  const toShort = (v: string) =>
                                    v
                                      .replace(/^(\d{1,2}):00\s*([صم])$/u, "$1$2")
                                      .replace(/\s+(ص|م)$/u, "$1")
                                      .trim();

                                  return `من ${toShort(startRaw)} الى ${toShort(endRaw)}`;
                                })()}
                            </span>
                            <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                              {isRTL ? 'الوقت' : 'Time'}
                            </span>
                          </div>
                          <div className="flex w-full flex-row items-start justify-between gap-3" dir="ltr">
                            <span className="min-w-0 flex-1 text-left font-medium" dir="auto">
                              {durationBookingLabel(perSessionDurationHours, isRTL)}
                            </span>
                            <span className="shrink-0 text-end text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                              {isRTL ? 'المدة' : 'Duration'}
                            </span>
                          </div>
                        </>
                      )}
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
                          {t('fields.phone.label')}
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
                          {t('fields.email.label')}
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


              {priceInfo && (
                <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{isRTL ? 'الإجمالي' : 'Total'}</span>
                  <div className="flex flex-col items-end gap-1 sm:text-end">
                    <span dir={isRTL ? 'rtl' : 'ltr'} className="text-xl font-black tabular-nums text-primary" lang={isRTL ? 'ar' : 'en'}>
                      {formatPriceValueThenCurrencyName(priceInfo, isRTL)}
                    </span>
                    {isFreeBooking ? (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {isRTL ? 'لا يلزم الدفع.' : 'No payment required.'}
                      </span>
                    ) : null}
                  </div>
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
                  {sessionsNeeded > 1
                    ? isRTL
                      ? '← تعديل المواعيد'
                      : '← Edit session times'
                    : isRTL
                      ? '← تغيير الموعد'
                      : '← Change date & time'}
                </Button>
                <Button
                  type="button"
                  className="w-full sm:flex-1 gap-2 rounded-xl min-h-11"
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
                      ? 'تأكيد الحجز (مجاني)'
                      : 'Confirm free booking'
                    : isRTL
                      ? 'تأكيد الحجز والدفع'
                      : 'Confirm booking & pay'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
    {/* Inline 3DS modal — opens when Tap returns a redirect_url for card verification */}
    {tap.challengeUrl && (
      <Checkout3DSModal url={tap.challengeUrl} onCancel={tap.cancelChallenge} />
    )}
  </>
  );
};

export default TrainingBookingFlow;
