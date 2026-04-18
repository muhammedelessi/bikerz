import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { Calendar, Hash, LayoutList } from 'lucide-react';

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CLEAR_VALUE = '__clear__';

export interface DateOfBirthPickerProps {
  value: string | null;
  onChange: (date: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

export function DateOfBirthPicker({
  value,
  onChange,
  disabled = false,
  required = false,
  error,
}: DateOfBirthPickerProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const isSyncingFromValueRef = useRef(false);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const maxYear = currentYear - 16;
    const minYear = currentYear - 100;
    const result: string[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) result.push(String(y));
    return result;
  }, [currentYear]);

  const monthNames = isRTL ? MONTHS_AR : MONTHS_EN;
  const daysInMonth =
    year && month
      ? new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
      : 31;
  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) =>
        String(i + 1).padStart(2, '0'),
      ),
    [daysInMonth],
  );

  useEffect(() => {
    isSyncingFromValueRef.current = true;
    if (value) {
      const [y, m, d] = value.split('-');
      setYear(y || '');
      setMonth(m || '');
      setDay(d || '');
    } else {
      setYear('');
      setMonth('');
      setDay('');
    }

    const timeoutId = window.setTimeout(() => {
      isSyncingFromValueRef.current = false;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  useEffect(() => {
    if (day && Number(day) > daysInMonth) {
      setDay('');
    }
  }, [day, daysInMonth]);

  useEffect(() => {
    if (isSyncingFromValueRef.current) return;

    if (year && month && day) {
      onChange(`${year}-${month}-${day}`);
      return;
    }

    if (!year && !month && !day) {
      onChange(null);
    }
  }, [day, month, onChange, year]);

  const triggerClass = 'text-start [&>span]:flex [&>span]:items-center [&>span]:gap-2';

  const selects = (
    <div className="grid grid-cols-3 gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
      <Select
        value={year || undefined}
        onValueChange={(v) => {
          if (v === CLEAR_VALUE) {
            setYear('');
            setMonth('');
            setDay('');
            return;
          }
          setYear(v);
        }}
        disabled={disabled}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <SelectTrigger className={triggerClass}>
          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <SelectValue
            placeholder={t('fields.dateOfBirth.yearPlaceholder')}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CLEAR_VALUE}>
            {isRTL ? 'مسح' : 'Clear'}
          </SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={y}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={month || undefined}
        onValueChange={(v) => {
          if (v === CLEAR_VALUE) {
            setMonth('');
            setDay('');
            return;
          }
          setMonth(v);
        }}
        disabled={disabled || !year}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <SelectTrigger className={triggerClass}>
          <LayoutList className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <SelectValue
            placeholder={t('fields.dateOfBirth.monthPlaceholder')}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CLEAR_VALUE}>
            {isRTL ? 'مسح' : 'Clear'}
          </SelectItem>
          {monthNames.map((name, idx) => {
            const valueMonth = String(idx + 1).padStart(2, '0');
            return (
              <SelectItem key={valueMonth} value={valueMonth}>
                {name}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Select
        value={day || undefined}
        onValueChange={(v) => setDay(v === CLEAR_VALUE ? '' : v)}
        disabled={disabled || !month}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <SelectTrigger className={triggerClass}>
          <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <SelectValue
            placeholder={t('fields.dateOfBirth.dayPlaceholder')}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CLEAR_VALUE}>
            {isRTL ? 'مسح' : 'Clear'}
          </SelectItem>
          {days.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <FormField
      label={t('fields.dateOfBirth.label')}
      error={error}
      required={required}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {selects}
    </FormField>
  );
}
