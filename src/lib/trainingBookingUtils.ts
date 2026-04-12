import { format, getDay, addDays, startOfDay, isBefore } from 'date-fns';

export type TrainerRow = {
  id: string;
  name_en: string;
  name_ar: string;
  photo_url: string | null;
};

export type TrainerCourseRow = {
  id: string;
  trainer_id: string;
  training_id: string;
  duration_hours: number;
  location: string;
  price: number;
  trainers: TrainerRow | null;
};

export type AvailRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

/** Treat DB/JSON oddities (string "true"/"false") so weekly hours match the admin editor */
export function availabilityRowOpen(row: AvailRow | undefined): boolean {
  if (!row) return false;
  const v = row.is_available as unknown;
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "t" || s === "1";
  }
  return false;
}

export type BookedSlot = {
  booking_date: string;
  start_time: string;
  status: string;
};

/** Extract HH:MM:SS from Postgres `time`, ISO strings, or plain clock fragments */
export function stripClockFromDbTime(t: unknown): string {
  const raw = String(t ?? "").trim();
  if (!raw) return "00:00:00";
  const iso = raw.match(/T(\d{1,2}:\d{2}(?::\d{2})?)/i);
  const part = (iso ? iso[1] : raw).split(".")[0];
  const m = part.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return "00:00:00";
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const se = m[3] != null ? Math.min(59, Math.max(0, parseInt(m[3], 10))) : 0;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(se).padStart(2, "0")}`;
}

export function timeToMinutes(t: string): number {
  const clock = stripClockFromDbTime(t);
  const p = clock.split(":").map((x) => parseInt(x, 10));
  return (p[0] || 0) * 60 + (p[1] || 0);
}

export function minutesToPgTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

export function normalizeDbTime(t: string): string {
  return stripClockFromDbTime(t);
}

export function buildSlots(availStart: string, availEnd: string, durationHours: number): string[] {
  const durMin = Math.round(Number(durationHours) * 60);
  if (!durMin || durMin <= 0) return [];
  let cur = timeToMinutes(stripClockFromDbTime(availStart));
  const endLimit = timeToMinutes(stripClockFromDbTime(availEnd));
  const out: string[] = [];
  while (cur + durMin <= endLimit) {
    out.push(minutesToPgTime(cur));
    cur += durMin;
  }
  return out;
}

export function slotBooked(dateStr: string, slotStart: string, booked: BookedSlot[]): boolean {
  const s = slotStart.slice(0, 8);
  return booked.some(
    (b) =>
      b.booking_date === dateStr &&
      normalizeDbTime(b.start_time).slice(0, 8) === s &&
      b.status !== 'cancelled',
  );
}

export function parseBlockedDatesSet(raw: unknown): Set<string> {
  if (!raw || !Array.isArray(raw)) return new Set();
  return new Set(
    (raw as string[]).map((d) => String(d).slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
  );
}

export function parseSpecialHoursMap(raw: unknown): Map<string, { start: string; end: string }> {
  const m = new Map<string, { start: string; end: string }>();
  if (!raw || !Array.isArray(raw)) return m;
  for (const x of raw as unknown[]) {
    const o = x as Record<string, unknown>;
    const date = String(o.date ?? '').slice(0, 10);
    const start = String(o.start ?? '09:00').slice(0, 5);
    const end = String(o.end ?? '17:00').slice(0, 5);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) m.set(date, { start, end });
  }
  return m;
}

/** One clock range inside a weekday (HH:MM). */
export type WeeklyClockSlot = { start: string; end: string };

export function parseTrainerBookingAvailability(
  extras: {
    availability_settings?: unknown;
    availability_blocked_dates?: unknown;
    availability_special_hours?: unknown;
  } | null | undefined,
): {
  blockedDateSet: Set<string>;
  specialHoursByDate: Map<string, { start: string; end: string }>;
  weeklySlotRanges: Map<number, WeeklyClockSlot[]> | null;
} {
  const settings =
    extras?.availability_settings && typeof extras.availability_settings === 'object'
      ? (extras.availability_settings as Record<string, unknown>)
      : null;

  let weeklySlotRanges: Map<number, WeeklyClockSlot[]> | null = null;

  if (settings && Array.isArray(settings.weekly) && settings.weekly.length > 0) {
    const m = new Map<number, WeeklyClockSlot[]>();
    for (const row of settings.weekly as unknown[]) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const day = Number(o.day);
      if (!Number.isFinite(day) || day < 0 || day > 6) continue;
      const slotsRaw = o.slots;
      const slots: WeeklyClockSlot[] = [];
      if (Array.isArray(slotsRaw)) {
        for (const s of slotsRaw) {
          if (!s || typeof s !== 'object') continue;
          const so = s as Record<string, unknown>;
          const start = String(so.start ?? '').slice(0, 5);
          const end = String(so.end ?? '').slice(0, 5);
          if (/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)) slots.push({ start, end });
        }
      }
      m.set(day, slots);
    }
    const hasAnyOpenSlot = [...m.values()].some((ranges) => ranges.length > 0);
    // If JSON has a weekly array but every day has no slots, fall back to trainer_availability rows
    // (otherwise booking ignores legacy rows and shows "no bookable times").
    weeklySlotRanges = hasAnyOpenSlot ? m : null;
  }

  const blockedDateSet =
    settings && Array.isArray(settings.blocked_dates)
      ? parseBlockedDatesSet(settings.blocked_dates)
      : parseBlockedDatesSet(extras?.availability_blocked_dates);

  const specialHoursByDate =
    settings && Array.isArray(settings.special_hours)
      ? parseSpecialHoursMap(settings.special_hours)
      : parseSpecialHoursMap(extras?.availability_special_hours);

  return { blockedDateSet, specialHoursByDate, weeklySlotRanges };
}

function dayHasWeeklyBookingWindow(
  dow: number,
  weeklySlotRanges: Map<number, WeeklyClockSlot[]> | null | undefined,
  availByDow: Map<number, AvailRow>,
): boolean {
  if (weeklySlotRanges && weeklySlotRanges.size > 0) {
    const ranges = weeklySlotRanges.get(dow) ?? [];
    return ranges.length > 0;
  }
  const row = availByDow.get(dow);
  return !!(row && availabilityRowOpen(row));
}

/** Map JS weekday (0=Sun..6=Sat) → row; coerces `day_of_week` from API (string vs number) */
export function buildAvailabilityByDow(rows: AvailRow[]): Map<number, AvailRow> {
  const m = new Map<number, AvailRow>();
  for (const a of rows) {
    const dow = Number(a.day_of_week);
    if (!Number.isFinite(dow) || dow < 0 || dow > 6) continue;
    m.set(dow, a);
  }
  return m;
}

export function getSlotsForDate(
  d: Date,
  course: TrainerCourseRow,
  availByDow: Map<number, AvailRow>,
  blockedDateSet: Set<string>,
  specialHoursByDate: Map<string, { start: string; end: string }>,
  weeklySlotRanges?: Map<number, WeeklyClockSlot[]> | null,
): string[] {
  const dateStr = format(d, 'yyyy-MM-dd');
  if (blockedDateSet.has(dateStr)) return [];
  const special = specialHoursByDate.get(dateStr);
  if (special) {
    const startT = special.start.length === 5 ? `${special.start}:00` : normalizeDbTime(special.start);
    const endT = special.end.length === 5 ? `${special.end}:00` : normalizeDbTime(special.end);
    const dh = Number((course as { duration_hours?: unknown }).duration_hours);
    return buildSlots(startT, endT, Number.isFinite(dh) && dh > 0 ? dh : 0);
  }
  const dow = getDay(d);
  const dh = Number((course as { duration_hours?: unknown }).duration_hours);
  const dur = Number.isFinite(dh) && dh > 0 ? dh : 0;

  if (weeklySlotRanges && weeklySlotRanges.size > 0) {
    const ranges = weeklySlotRanges.get(dow) ?? [];
    if (!ranges.length) return [];
    const acc: string[] = [];
    for (const r of ranges) {
      const st = r.start.length === 5 ? `${r.start}:00` : normalizeDbTime(r.start);
      const en = r.end.length === 5 ? `${r.end}:00` : normalizeDbTime(r.end);
      if (timeToMinutes(stripClockFromDbTime(en)) <= timeToMinutes(stripClockFromDbTime(st))) continue;
      acc.push(...buildSlots(st, en, dur));
    }
    const uniq = [...new Set(acc)];
    uniq.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    return uniq;
  }

  const row = availByDow.get(dow);
  if (!row || !availabilityRowOpen(row)) return [];
  return buildSlots(row.start_time, row.end_time, dur);
}

export function hasUnbookedSlotInRange(
  course: TrainerCourseRow,
  availByDow: Map<number, AvailRow>,
  blocked: Set<string>,
  special: Map<string, { start: string; end: string }>,
  booked: BookedSlot[],
  numDays: number,
  weeklySlotRanges?: Map<number, WeeklyClockSlot[]> | null,
): boolean {
  const today = startOfDay(new Date());
  for (let i = 0; i < numDays; i++) {
    const d = addDays(today, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    if (blocked.has(dateStr)) continue;
    if (!special.has(dateStr)) {
      if (!dayHasWeeklyBookingWindow(getDay(d), weeklySlotRanges, availByDow)) continue;
    }
    const slots = getSlotsForDate(d, course, availByDow, blocked, special, weeklySlotRanges);
    if (slots.some((slot) => !slotBooked(dateStr, slot, booked))) return true;
  }
  return false;
}

export function slotEndTimePg(startSlot: string, durationHours: number): string {
  const parts = startSlot.split(':').map((x) => parseInt(x, 10));
  const startMin = (parts[0] || 0) * 60 + (parts[1] || 0);
  const endMin = startMin + Math.round(Number(durationHours) * 60);
  return minutesToPgTime(endMin);
}

/** 12h display: Arabic ص/م, English AM/PM */
export function formatTime12hClock(isoTime: string, isRTL: boolean): string {
  const t = normalizeDbTime(isoTime).slice(0, 5);
  const [hs, ms] = t.split(':');
  const h = parseInt(hs, 10) || 0;
  const m = parseInt(ms, 10) || 0;
  const isPM = h >= 12;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const mm = String(m).padStart(2, '0');
  if (isRTL) return `${h12}:${mm} ${isPM ? 'م' : 'ص'}`;
  return `${h12}:${mm} ${isPM ? 'PM' : 'AM'}`;
}

/** Time without trailing period label (for two-line slot UI). */
export function formatTimeClockOnly(isoTime: string, isRTL: boolean): string {
  return formatTime12hClock(isoTime, isRTL).replace(/\s+(ص|م|AM|PM)$/u, '').trim();
}

export function slotPeriodLabel(isoTime: string, isRTL: boolean): string {
  const t = normalizeDbTime(isoTime).slice(0, 5);
  const h = parseInt(t.split(':')[0] || '0', 10);
  const isPM = h >= 12;
  if (isRTL) return isPM ? 'م' : 'ص';
  return isPM ? 'PM' : 'AM';
}

export function durationBookingLabel(hours: number, isRTL: boolean): string {
  const n = Number(hours);
  if (!isRTL) return `${n} ${n === 1 ? 'hour' : 'hours'}`;
  if (n === 1) return 'ساعة واحدة';
  if (n === 2) return 'ساعتان';
  return `${n} ساعات`;
}

export function isDaySelectable(
  d: Date,
  availByDow: Map<number, AvailRow>,
  blockedDateSet: Set<string>,
  specialHoursByDate: Map<string, { start: string; end: string }>,
  weeklySlotRanges?: Map<number, WeeklyClockSlot[]> | null,
): boolean {
  const today = startOfDay(new Date());
  if (isBefore(startOfDay(d), today)) return false;
  const dateStr = format(d, 'yyyy-MM-dd');
  if (blockedDateSet.has(dateStr)) return false;
  if (specialHoursByDate.has(dateStr)) return true;
  const dow = getDay(d);
  if (weeklySlotRanges && weeklySlotRanges.size > 0) {
    const ranges = weeklySlotRanges.get(dow) ?? [];
    return ranges.length > 0;
  }
  const row = availByDow.get(dow);
  return !!(row && availabilityRowOpen(row));
}

export function dayHasFreeSlot(
  d: Date,
  course: TrainerCourseRow,
  availByDow: Map<number, AvailRow>,
  blockedDateSet: Set<string>,
  specialHoursByDate: Map<string, { start: string; end: string }>,
  booked: BookedSlot[],
  weeklySlotRanges?: Map<number, WeeklyClockSlot[]> | null,
): boolean {
  if (!isDaySelectable(d, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges)) return false;
  const dateStr = format(d, 'yyyy-MM-dd');
  const slots = getSlotsForDate(d, course, availByDow, blockedDateSet, specialHoursByDate, weeklySlotRanges);
  return slots.some((slot) => !slotBooked(dateStr, slot, booked));
}
