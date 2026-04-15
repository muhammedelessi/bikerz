import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  selectedLabelBuilder?: (option: DropdownOption | undefined) => string;
  hasError?: boolean;
  disabled?: boolean;
  dir?: 'ltr' | 'rtl';
}

var SearchableDropdown: React.FC<SearchableDropdownProps> = function (props) {
  var options = props.options;
  var value = props.value;
  var onChange = props.onChange;
  var placeholder = props.placeholder;
  var searchPlaceholder = props.searchPlaceholder;
  var selectedLabelBuilder = props.selectedLabelBuilder;
  var hasError = props.hasError || false;
  var disabled = props.disabled || false;
  var dir = props.dir;

  var _open = useState(false);
  var isOpen = _open[0];
  var setIsOpen = _open[1];

  var _search = useState('');
  var search = _search[0];
  var setSearch = _search[1];

  var containerRef = useRef<HTMLDivElement>(null);
  var searchRef = useRef<HTMLInputElement>(null);
  var listRef = useRef<HTMLDivElement>(null);

  var selectedOption: DropdownOption | undefined = undefined;
  for (var i = 0; i < options.length; i++) {
    if (options[i].value === value) {
      selectedOption = options[i];
      break;
    }
  }
  var selectedLabel = selectedLabelBuilder ? selectedLabelBuilder(selectedOption) : (selectedOption ? selectedOption.label : '');

  var filtered: DropdownOption[] = [];
  var q = search.toLowerCase().trim();
  for (var j = 0; j < options.length; j++) {
    if (!q || options[j].label.toLowerCase().indexOf(q) !== -1) {
      filtered.push(options[j]);
    }
  }

  var toggle = useCallback(function () {
    if (disabled) return;
    setIsOpen(function (prev) { return !prev; });
    setSearch('');
  }, [disabled]);

  var select = useCallback(function (val: string) {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  }, [onChange]);

  // Close on outside click
  useEffect(function () {
    if (!isOpen) return;
    var handler = function (e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return function () {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen]);

  // Focus search on open
  useEffect(function () {
    if (isOpen && searchRef.current) {
      // Small delay for iOS keyboard
      setTimeout(function () {
        if (searchRef.current) searchRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(function () {
    if (isOpen && listRef.current && value) {
      var active = listRef.current.querySelector('[data-active="true"]');
      if (active) {
        active.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, value]);

  return (
    <div ref={containerRef} className="relative w-full" dir={dir || undefined}>
      {/* Trigger */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={cn(
          "flex h-11 sm:h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-start",
          hasError ? 'border-destructive' : 'border-input'
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 shrink-0 opacity-50 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute z-[100] mt-1 w-full rounded-md border border-border bg-popover shadow-lg"
          style={{ maxHeight: '280px' }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={function (e) { setSearch(e.target.value); }}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
              dir={dir || undefined}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {search && (
              <button
                type="button"
                onClick={function () { setSearch(''); if (searchRef.current) searchRef.current.focus(); }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: '224px', WebkitOverflowScrolling: 'touch' }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                {document.documentElement.dir === 'rtl' || dir === 'rtl' ? 'لا توجد نتائج' : 'No results'}
              </div>
            ) : (
              filtered.map(function (opt) {
                var isActive = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-active={isActive ? 'true' : 'false'}
                    onClick={function () { select(opt.value); }}
                    className={cn(
                      "flex w-full items-center px-3 py-3 sm:py-2.5 text-sm text-start transition-colors",
                      "active:bg-accent/80 hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent text-accent-foreground font-medium"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
