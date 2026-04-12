import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { availabilityRowOpen, timeToMinutes, stripClockFromDbTime, type AvailRow } from '@/lib/trainingBookingUtils';
import { cn } from '@/lib/utils';

export type TimeSlot = { start: string; end: string };

export type DaySchedule = {
  day: number;
  name_ar: string;
  name_en: string;
  slots: TimeSlot[];
};

type SpecialHour = { date: string; start: string; end: string };

const DEFAULT_WEEKLY: DaySchedule[] = [
  { day: 6, name_ar: 'السبت', name_en: 'Saturday', slots: [] },
  { day: 0, name_ar: 'الأحد', name_en: 'Sunday', slots: [] },
  { day: 1, name_ar: 'الاثنين', name_en: 'Monday', slots: [] },
  { day: 2, name_ar: 'الثلاثاء', name_en: 'Tuesday', slots: [] },
  { day: 3, name_ar: 'الأربعاء', name_en: 'Wednesday', slots: [] },
  { day: 4, name_ar: 'الخميس', name_en: 'Thursday', slots: [] },
  { day: 5, name_ar: 'الجمعة', name_en: 'Friday', slots: [] },
];

function cloneDefaultWeekly(): DaySchedule[] {
  return DEFAULT_WEEKLY.map((d) => ({ ...d, slots: [...d.slots] }));
}

function toInputTimeValue(dbTime: string | undefined): string {
  if (!dbTime) return '09:00';
  const parts = String(dbTime).split(':');
  return `${parts[0]?.padStart(2, '0') || '09'}:${parts[1]?.padStart(2, '0') || '00'}`;
}

function normalizeTimeInput(v: string): string {
  const t = v.trim();
  if (!t) return '09:00:00';
  if (t.length === 5) return `${t}:00`;
  return t;
}

function parseSpecialHours(raw: unknown): SpecialHour[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = x as Record<string, unknown>;
      const date = String(o.date ?? '').slice(0, 10);
      const start = String(o.start ?? '').slice(0, 5);
      const end = String(o.end ?? '').slice(0, 5);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { date, start, end };
    })
    .filter(Boolean) as SpecialHour[];
}

function parseBlockedDates(raw: unknown): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  return [...new Set((raw as string[]).map((d) => String(d).slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
}

function minutesToHHmm(m: number): string {
  const clamped = Math.max(0, Math.min(m, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function slotEndAfterStart(start: string, end: string): boolean {
  return timeToMinutes(stripClockFromDbTime(`${end}:00`)) > timeToMinutes(stripClockFromDbTime(`${start}:00`));
}

function daySlotsOverlap(slots: TimeSlot[]): boolean {
  const valid = slots.filter((s) => slotEndAfterStart(s.start, s.end));
  if (valid.length < 2) return false;
  const iv = valid
    .map((s) => [timeToMinutes(stripClockFromDbTime(`${s.start}:00`)), timeToMinutes(stripClockFromDbTime(`${s.end}:00`))] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < iv.length; i++) {
    if (iv[i]![0] < iv[i - 1]![1]) return true;
  }
  return false;
}

const DateInputShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('min-w-0 [unicode-bidi:isolate]', className)} dir="ltr" lang="en">
    {children}
  </div>
);

type Props = {
  trainerId: string;
  isRTL: boolean;
};

export const TrainerScheduleManager: React.FC<Props> = ({ trainerId, isRTL }) => {
  const queryClient = useQueryClient();
  const dir = isRTL ? 'rtl' : 'ltr';
  const todayYmd = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const { data, isLoading } = useQuery({
    queryKey: ['trainer-schedule-manager', trainerId],
    enabled: !!trainerId,
    queryFn: async () => {
      const [avRes, trRes] = await Promise.all([
        supabase.from('trainer_availability').select('day_of_week, start_time, end_time, is_available').eq('trainer_id', trainerId),
        supabase.from('trainers').select('*').eq('id', trainerId).single(),
      ]);
      if (avRes.error) throw avRes.error;
      if (trRes.error) throw trRes.error;
      return {
        rows: (avRes.data || []) as AvailRow[],
        trainer: trRes.data,
      };
    },
  });

  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(() => cloneDefaultWeekly());
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [specialHours, setSpecialHours] = useState<SpecialHour[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newSpecial, setNewSpecial] = useState<{ date: string; start: string; end: string }>({ date: '', start: '09:00', end: '17:00' });

  const hydrateFromServer = useCallback(() => {
    if (!data?.trainer) return;

    const tr = data.trainer as Record<string, unknown>;
    const settings = tr.availability_settings as Record<string, unknown> | null | undefined;
    const weeklyRaw = settings && Array.isArray(settings.weekly) ? (settings.weekly as unknown[]) : null;

    let nextWeekly = cloneDefaultWeekly();

    if (weeklyRaw && weeklyRaw.length > 0) {
      nextWeekly = nextWeekly.map((def) => {
        const row = weeklyRaw.find((r) => Number((r as Record<string, unknown>).day) === def.day) as Record<string, unknown> | undefined;
        if (!row || !Array.isArray(row.slots)) return def;
        const slots: TimeSlot[] = [];
        for (const s of row.slots as unknown[]) {
          if (!s || typeof s !== 'object') continue;
          const so = s as Record<string, unknown>;
          const start = String(so.start ?? '').slice(0, 5);
          const end = String(so.end ?? '').slice(0, 5);
          if (/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)) slots.push({ start, end });
        }
        return { ...def, slots };
      });
      const jsonHasAnySlot = nextWeekly.some((d) => d.slots.length > 0);
      if (!jsonHasAnySlot) {
        nextWeekly = cloneDefaultWeekly().map((def) => {
          const found = data.rows.find((r) => Number(r.day_of_week) === def.day);
          if (found && availabilityRowOpen(found)) {
            return {
              ...def,
              slots: [{ start: toInputTimeValue(found.start_time), end: toInputTimeValue(found.end_time) }],
            };
          }
          return def;
        });
      }
    } else {
      nextWeekly = nextWeekly.map((def) => {
        const found = data.rows.find((r) => Number(r.day_of_week) === def.day);
        if (found && availabilityRowOpen(found)) {
          return {
            ...def,
            slots: [{ start: toInputTimeValue(found.start_time), end: toInputTimeValue(found.end_time) }],
          };
        }
        return def;
      });
    }

    setWeeklySchedule(nextWeekly);

    const blockedFromSettings = settings && Array.isArray(settings.blocked_dates) ? parseBlockedDates(settings.blocked_dates) : null;
    setBlockedDates(blockedFromSettings ?? parseBlockedDates(tr.availability_blocked_dates));

    const specialFromSettings =
      settings && Array.isArray(settings.special_hours) ? parseSpecialHours(settings.special_hours) : null;
    setSpecialHours(specialFromSettings ?? parseSpecialHours(tr.availability_special_hours));
  }, [data]);

  useEffect(() => {
    hydrateFromServer();
  }, [hydrateFromServer]);

  const formatDateDisplay = useCallback(
    (dateStr: string) => {
      try {
        return format(parseISO(dateStr), 'dd MMM yyyy', { locale: isRTL ? ar : undefined });
      } catch {
        return dateStr;
      }
    },
    [isRTL],
  );

  const updateSlot = (dayNum: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    setWeeklySchedule((prev) =>
      prev.map((d) =>
        d.day !== dayNum
          ? d
          : {
              ...d,
              slots: d.slots.map((s, i) => (i === slotIndex ? { ...s, [field]: value.slice(0, 5) } : s)),
            },
      ),
    );
  };

  const addSlot = (dayNum: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.day !== dayNum) return d;
        if (d.slots.length === 0) return { ...d, slots: [{ start: '09:00', end: '17:00' }] };
        const last = d.slots[d.slots.length - 1]!;
        let startM = 15 * 60;
        let endM = 18 * 60;
        if (slotEndAfterStart(last.start, last.end)) {
          startM = timeToMinutes(stripClockFromDbTime(`${last.end}:00`));
          endM = Math.min(startM + 180, 23 * 60 + 30);
          if (endM <= startM) {
            startM = 15 * 60;
            endM = 18 * 60;
          }
        }
        return { ...d, slots: [...d.slots, { start: minutesToHHmm(startM), end: minutesToHHmm(endM) }] };
      }),
    );
  };

  const removeSlot = (dayNum: number, slotIndex: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => (d.day !== dayNum ? d : { ...d, slots: d.slots.filter((_, i) => i !== slotIndex) })),
    );
  };

  const clearDay = (dayNum: number) => {
    setWeeklySchedule((prev) => prev.map((d) => (d.day !== dayNum ? d : { ...d, slots: [] })));
  };

  const addBlockedDate = () => {
    const d = newBlockedDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      toast.error(isRTL ? 'اختر تاريخاً صالحاً' : 'Pick a valid date');
      return;
    }
    if (blockedDates.includes(d)) {
      toast.error(isRTL ? 'التاريخ مضاف مسبقاً' : 'Date already blocked');
      return;
    }
    setBlockedDates((prev) => [...prev, d].sort());
    setNewBlockedDate('');
  };

  const addSpecialHour = () => {
    const d = newSpecial.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      toast.error(isRTL ? 'اختر تاريخاً صالحاً' : 'Pick a valid date');
      return;
    }
    if (!slotEndAfterStart(newSpecial.start, newSpecial.end)) {
      toast.error(isRTL ? 'وقت النهاية يجب أن يكون بعد وقت البداية' : 'End time must be after start time');
      return;
    }
    if (specialHours.some((s) => s.date === d)) {
      toast.error(isRTL ? 'يوجد بالفعل ساعات خاصة لهذا اليوم' : 'Special hours already exist for this date');
      return;
    }
    setSpecialHours((prev) =>
      [...prev, { date: d, start: newSpecial.start.slice(0, 5), end: newSpecial.end.slice(0, 5) }].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );
    setNewSpecial({ date: '', start: '09:00', end: '17:00' });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const day of weeklySchedule) {
        for (const slot of day.slots) {
          if (!slotEndAfterStart(slot.start, slot.end)) {
            throw new Error(isRTL ? 'وقت النهاية يجب أن يكون بعد وقت البداية' : 'End time must be after start time');
          }
        }
        if (daySlotsOverlap(day.slots)) {
          toast.message(isRTL ? 'تنبيه: فترات متداخلة' : 'Warning: overlapping time slots', {
            description: isRTL ? `يوم ${day.name_ar}` : `${day.name_en}`,
          });
        }
      }

      const settings = {
        weekly: weeklySchedule,
        blocked_dates: blockedDates,
        special_hours: specialHours,
      };

      const specialPayload = specialHours.map((s) => ({
        date: s.date,
        start: s.start.length === 5 ? s.start : s.start.slice(0, 5),
        end: s.end.length === 5 ? s.end : s.end.slice(0, 5),
      }));

      const trainerUpdateFull = {
        availability_settings: settings,
        availability_blocked_dates: blockedDates,
        availability_special_hours: specialPayload,
      };
      const trainerUpdateLegacy = {
        availability_blocked_dates: blockedDates,
        availability_special_hours: specialPayload,
      };

      let trErr = (await supabase.from('trainers').update(trainerUpdateFull).eq('id', trainerId)).error;
      const msg = (trErr?.message ?? '').toLowerCase();
      if (
        trErr &&
        msg.includes('availability_settings') &&
        (msg.includes('schema cache') || msg.includes('column') || msg.includes('does not exist'))
      ) {
        trErr = (await supabase.from('trainers').update(trainerUpdateLegacy).eq('id', trainerId)).error;
        if (!trErr) {
          toast.message(isRTL ? 'تم الحفظ بدون عمود الجدول JSON' : 'Saved without JSON schedule column', {
            description: isRTL
              ? 'نفّذ ترحيل قاعدة البيانات (availability_settings) ثم أعد الحفظ لدعم عدة فترات يومياً والمزامنة الكاملة.'
              : 'Apply the trainers migration (availability_settings), then save again for multi-slot days and full sync.',
          });
        }
      }
      if (trErr) throw trErr;

      const upserts = weeklySchedule.map((day) => {
        if (day.slots.length === 0) {
          return {
            trainer_id: trainerId,
            day_of_week: day.day,
            start_time: '09:00:00',
            end_time: '17:00:00',
            is_available: false,
          };
        }
        const starts = day.slots.map((s) => timeToMinutes(stripClockFromDbTime(`${s.start}:00`)));
        const ends = day.slots.map((s) => timeToMinutes(stripClockFromDbTime(`${s.end}:00`)));
        const minM = Math.min(...starts);
        const maxM = Math.max(...ends);
        return {
          trainer_id: trainerId,
          day_of_week: day.day,
          start_time: normalizeTimeInput(minutesToHHmm(minM)),
          end_time: normalizeTimeInput(minutesToHHmm(maxM)),
          is_available: true,
        };
      });

      const { error: avErr } = await supabase.from('trainer_availability').upsert(upserts, {
        onConflict: 'trainer_id,day_of_week',
      });
      if (avErr) throw avErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-schedule-manager', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-availability-public', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-booking-extras', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-view', trainerId] });
      toast.success(isRTL ? 'تم حفظ الجدول بنجاح' : 'Schedule saved');
    },
    onError: (e: Error) => toast.error(e.message || (isRTL ? 'فشل الحفظ' : 'Save failed')),
  });

  if (isLoading) {
    return (
      <div className="space-y-3" dir={dir}>
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-10 pb-8" dir={dir}>
        {/* Weekly */}
        <section className="space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-base font-bold text-foreground">
              {isRTL ? '📅 الجدول الأسبوعي' : '📅 Weekly schedule'}
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {weeklySchedule.map((day) => {
              const overlap = daySlotsOverlap(day.slots);
              return (
                <div
                  key={day.day}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl px-4 py-3 transition-colors',
                    day.slots.length > 0 ? 'border border-primary/20 bg-primary/5' : 'border border-border/40',
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'h-2.5 w-2.5 shrink-0 rounded-full',
                          day.slots.length > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                        )}
                      />
                      <span className="w-24 shrink-0 text-sm font-medium">{isRTL ? day.name_ar : day.name_en}</span>
                    </div>

                    {day.slots.length === 0 ? (
                      <span className="text-xs text-muted-foreground sm:flex-1">{isRTL ? 'غير متاح' : 'Unavailable'}</span>
                    ) : (
                      <div className="hidden flex-1 sm:block" />
                    )}

                    <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
                      {day.slots.length > 0 ? (
                        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addSlot(day.day)}>
                          <Plus className="h-3 w-3" />
                          {isRTL ? 'فترة' : 'Add slot'}
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addSlot(day.day)}>
                          <Plus className="h-3 w-3" />
                          {isRTL ? 'تفعيل' : 'Enable'}
                        </Button>
                      )}
                      {day.slots.length > 0 ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => clearDay(day.day)}
                          aria-label={isRTL ? 'مسح اليوم' : 'Clear day'}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {day.slots.map((slot, si) => {
                      const invalid = !slotEndAfterStart(slot.start, slot.end);
                      const tip = isRTL ? 'وقت النهاية يجب أن يكون بعد وقت البداية' : 'End time must be after start time';
                      const timeCls = cn(
                        'h-8 w-full max-w-[11rem] rounded-lg border bg-background px-2 text-sm sm:w-28',
                        invalid ? 'border-destructive ring-1 ring-destructive/40' : 'border-border',
                      );
                      return (
                        <motion.div
                          key={`${day.day}-${si}`}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-col gap-2 ps-0 sm:flex-row sm:items-center sm:gap-2 sm:ps-8"
                        >
                          {invalid ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <input
                                  type="time"
                                  value={slot.start}
                                  onChange={(e) => updateSlot(day.day, si, 'start', e.target.value)}
                                  dir="ltr"
                                  lang="en"
                                  className={timeCls}
                                />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs border-destructive/40 bg-destructive/10 text-destructive">{tip}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateSlot(day.day, si, 'start', e.target.value)}
                              dir="ltr"
                              lang="en"
                              className={timeCls}
                            />
                          )}
                          <span className="text-xs text-muted-foreground">{isRTL ? 'إلى' : 'to'}</span>
                          {invalid ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <input
                                  type="time"
                                  value={slot.end}
                                  onChange={(e) => updateSlot(day.day, si, 'end', e.target.value)}
                                  dir="ltr"
                                  lang="en"
                                  className={timeCls}
                                />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs border-destructive/40 bg-destructive/10 text-destructive">{tip}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateSlot(day.day, si, 'end', e.target.value)}
                              dir="ltr"
                              lang="en"
                              className={timeCls}
                            />
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                            onClick={() => removeSlot(day.day, si)}
                            aria-label={isRTL ? 'حذف الفترة' : 'Remove slot'}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {overlap ? (
                    <p className="ps-0 text-xs text-amber-600 sm:ps-8 dark:text-amber-400">
                      {isRTL ? 'تحذير: فترات زمنية متداخلة في هذا اليوم.' : 'Warning: overlapping time slots on this day.'}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Blocked */}
        <section className="space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-base font-bold text-foreground">{isRTL ? '🚫 أيام الإجازة' : '🚫 Blocked dates'}</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DateInputShell className="flex-1 sm:max-w-[200px]">
              <input
                type="date"
                min={todayYmd}
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </DateInputShell>
            <Button type="button" size="sm" className="h-9 gap-1 sm:shrink-0" onClick={addBlockedDate} disabled={!newBlockedDate}>
              <Plus className="h-4 w-4" />
              {isRTL ? 'إضافة' : 'Add'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...blockedDates].sort().map((date) => (
              <div
                key={date}
                className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 dark:text-red-400"
              >
                <span aria-hidden>🚫</span>
                <span>{formatDateDisplay(date)}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 transition-colors hover:text-red-800 dark:hover:text-red-200"
                  onClick={() => setBlockedDates((prev) => prev.filter((x) => x !== date))}
                  aria-label={isRTL ? 'إزالة' : 'Remove'}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {blockedDates.length === 0 ? (
              <p className="text-xs text-muted-foreground">{isRTL ? 'لا توجد أيام محجوبة' : 'No blocked dates'}</p>
            ) : null}
          </div>
        </section>

        {/* Special */}
        <section className="space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-base font-bold text-foreground">{isRTL ? '⭐ ساعات خاصة' : '⭐ Special hours'}</h2>
          </div>
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">
            <DateInputShell className="w-full sm:w-40">
              <input
                type="date"
                min={todayYmd}
                value={newSpecial.date}
                onChange={(e) => setNewSpecial((p) => ({ ...p, date: e.target.value }))}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </DateInputShell>
            <input
              type="time"
              value={newSpecial.start}
              onChange={(e) => setNewSpecial((p) => ({ ...p, start: e.target.value }))}
              dir="ltr"
              lang="en"
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm sm:w-28"
            />
            <span className="text-xs text-muted-foreground">{isRTL ? 'إلى' : 'to'}</span>
            <input
              type="time"
              value={newSpecial.end}
              onChange={(e) => setNewSpecial((p) => ({ ...p, end: e.target.value }))}
              dir="ltr"
              lang="en"
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm sm:w-28"
            />
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1"
              disabled={!newSpecial.date || !newSpecial.start || !newSpecial.end}
              onClick={addSpecialHour}
            >
              <Plus className="h-4 w-4" />
              {isRTL ? 'إضافة' : 'Add'}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {[...specialHours]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((sh, i) => (
                <div
                  key={`${sh.date}-${sh.start}-${sh.end}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                    <span aria-hidden>⭐</span>
                    <span className="font-medium">{formatDateDisplay(sh.date)}</span>
                    <span className="text-muted-foreground">|</span>
                    <span dir="ltr" className="font-mono text-xs text-amber-700 dark:text-amber-400">
                      {sh.start} — {sh.end}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    onClick={() =>
                      setSpecialHours((prev) =>
                        prev.filter((x) => !(x.date === sh.date && x.start === sh.start && x.end === sh.end)),
                      )
                    }
                    aria-label={isRTL ? 'حذف' : 'Remove'}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            {specialHours.length === 0 ? (
              <p className="text-xs text-muted-foreground">{isRTL ? 'لا توجد ساعات خاصة' : 'No special hours'}</p>
            ) : null}
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-1 mt-8 border-t border-border bg-background py-4">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full gap-2 sm:w-auto"
            size="lg"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isRTL ? 'حفظ جميع التغييرات' : 'Save All Changes'}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};

/** @deprecated Use TrainerScheduleManager — kept for import stability */
export const TrainerAvailabilityEditor = TrainerScheduleManager;
