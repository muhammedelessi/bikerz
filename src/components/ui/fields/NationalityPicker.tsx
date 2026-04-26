import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { FormField } from '@/components/ui/form-field';
import { COUNTRIES } from '@/data/countryCityData';
import { ChevronDown, X } from 'lucide-react';

export interface NationalityPickerProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
}

export function NationalityPicker({
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}: NationalityPickerProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setTimeout(() => searchRef.current?.focus(), 50);
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = COUNTRIES.find((c) => c.code === value);
  const displayLabel = selected ? (isRTL ? selected.ar : selected.en) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.en.toLowerCase().includes(q) || c.ar.includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <FormField
      label={t('fields.nationality.label')}
      error={error ?? undefined}
      required={required}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="relative" ref={containerRef}>
        <div
          className={`flex h-10 w-full items-stretch overflow-hidden rounded-md border bg-background text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring disabled:opacity-50 ${
            error ? 'border-destructive' : 'border-input'
          } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-start ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed"
          >
            <span className={`min-w-0 flex-1 truncate ${displayLabel ? 'text-foreground' : 'text-muted-foreground'}`}>
              {displayLabel || t('fields.nationality.placeholder')}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          {value && !disabled ? (
            <button
              type="button"
              className="shrink-0 border-s border-input px-2.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={() => onChange('')}
              aria-label={isRTL ? 'مسح' : 'Clear'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
            {/* Search */}
            <div className="px-3 py-2 border-b border-border/40">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isRTL ? 'بحث...' : 'Search...'}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {/* Clear option */}
              <button
                type="button"
                className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground ${!value ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={() => { onChange(''); setOpen(false); }}
              >
                {isRTL ? 'غير محدد' : 'Not set'}
              </button>
              {filtered.length === 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground text-center">
                  {isRTL ? 'لا توجد نتائج' : 'No results'}
                </p>
              )}
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${value === c.code ? 'bg-accent text-accent-foreground' : ''}`}
                  onClick={() => { onChange(c.code); setOpen(false); }}
                >
                  {isRTL ? c.ar : c.en}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </FormField>
  );
}
