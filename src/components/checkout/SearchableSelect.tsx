import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Option {
  value: string;
  label: string;
  searchLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  className?: string;
  hasError?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  hasError,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }
  }, [open]);

  const filtered = search.trim()
    ? options.filter((o) => {
        const q = search.toLowerCase();
        return o.label.toLowerCase().includes(q) || o.searchLabel?.toLowerCase().includes(q);
      })
    : options;

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal h-10',
            !value && 'text-muted-foreground',
            hasError && 'border-destructive',
            className
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="max-h-[200px]">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <div className="p-1">
              {filtered.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    value === option.value && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 flex-shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableSelect;
