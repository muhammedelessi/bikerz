import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { FormField } from '@/components/ui/form-field';
import { ChevronDown } from 'lucide-react';

const GENDER_OPTIONS = [
  { value: 'Male', ar: 'ذكر', en: 'Male' },
  { value: 'Female', ar: 'أنثى', en: 'Female' },
  { value: 'Other', ar: 'آخر', en: 'Other' },
] as const;

export interface GenderPickerProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export function GenderPicker({
  value,
  onChange,
  error,
  disabled = false,
  required = false,
}: GenderPickerProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selectedOption = GENDER_OPTIONS.find((o) => o.value === value);
  const displayLabel = selectedOption
    ? isRTL ? selectedOption.ar : selectedOption.en
    : null;

  return (
    <FormField
      label={t('fields.gender.label')}
      error={error}
      required={required}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={`flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-destructive' : 'border-input'
          }`}
        >
          <span
            className={`flex-1 text-start truncate ${
              displayLabel ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {displayLabel || t('fields.gender.placeholder')}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-[160px] rounded-md border border-border bg-popover shadow-lg overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              <button
                type="button"
                className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground ${
                  !value ? 'bg-accent text-accent-foreground' : ''
                }`}
                onClick={() => { onChange(''); setOpen(false); }}
              >
                {isRTL ? 'غير محدد' : 'Not set'}
              </button>
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${
                    value === opt.value ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                >
                  {isRTL ? opt.ar : opt.en}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </FormField>
  );
}
