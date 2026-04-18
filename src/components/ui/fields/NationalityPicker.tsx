import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { FormField } from '@/components/ui/form-field';
import { COUNTRIES } from '@/data/countryCityData';
import { Globe, ChevronDown, Search, X } from 'lucide-react';

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
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-destructive' : 'border-input'
          }`}
        >
          <Globe className="w-4 h-4 text-muted-foreground me-2 flex-shrink-0" />
          <span className={`flex-1 text-start truncate ${displayLabel ? 'text-foreground' : 'text-muted-foreground'}`}>
            {displayLabel || t('fields.nationality.placeholder')}
          </span>
          {value && (
            <button
              type="button"
              className="me-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isRTL ? 'بحث...' : 'Search...'}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
