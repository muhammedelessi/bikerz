import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { COUNTRIES, OTHER_OPTION, getCityDisplayLabel } from '@/data/countryCityData';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { ChevronDown, Search } from 'lucide-react';

const OTHER_VALUE = '__other__';

export interface CountryCityPickerProps {
  country: string;
  city: string;
  onCountryChange: (country: string) => void;
  onCityChange: (city: string) => void;
  customCountry?: string;
  onCustomCountryChange?: (value: string) => void;
  customCity?: string;
  onCustomCityChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  countryError?: string;
  cityError?: string;
  layout?: 'row' | 'column';
}

export function CountryCityPicker({
  country,
  city,
  onCountryChange,
  onCityChange,
  customCountry = '',
  onCustomCountryChange,
  customCity = '',
  onCustomCityChange,
  disabled = false,
  required = false,
  countryError,
  cityError,
  layout = 'row',
}: CountryCityPickerProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const isOtherCountry = country === OTHER_VALUE;
  const isOtherCity = city === OTHER_VALUE;

  const selectedCountryEntry = useMemo(
    () => COUNTRIES.find((c) => c.code === country),
    [country],
  );

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.en.toLowerCase().includes(q) || c.ar.includes(q),
    );
  }, [countrySearch]);

  const cities = useMemo(
    () => selectedCountryEntry?.cities || [],
    [selectedCountryEntry],
  );

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const q = citySearch.toLowerCase();
    return cities.filter(
      (c) => c.en.toLowerCase().includes(q) || c.ar.includes(q),
    );
  }, [cities, citySearch]);

  const hasCities = cities.length > 0 && !isOtherCountry;

  const handleCountrySelect = (code: string) => {
    onCountryChange(code);
    onCityChange('');
    onCustomCityChange?.('');
    onCustomCountryChange?.('');
    setCountryOpen(false);
    setCountrySearch('');
  };

  const handleOtherCountrySelect = () => {
    onCountryChange(OTHER_VALUE);
    onCityChange('');
    onCustomCityChange?.('');
    setCountryOpen(false);
    setCountrySearch('');
  };

  const handleCitySelect = (val: string) => {
    onCityChange(val);
    setCityOpen(false);
    setCitySearch('');
  };

  const handleOtherCitySelect = () => {
    onCityChange(OTHER_VALUE);
    setCityOpen(false);
    setCitySearch('');
  };

  const wrapperClass =
    layout === 'column'
      ? 'flex flex-col gap-4'
      : 'grid grid-cols-1 sm:grid-cols-2 gap-4';

  return (
    <div className={wrapperClass}>
      {/* Country */}
      <FormField
        label={t('fields.country.label')}
        required={required}
        error={countryError}
      >
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCountryOpen(!countryOpen);
              setCityOpen(false);
            }}
            className={`flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              countryError ? 'border-destructive' : 'border-input'
            }`}
          >
            <span
              className={`flex-1 text-start truncate ${
                selectedCountryEntry || isOtherCountry
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {isOtherCountry
                ? (isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en)
                : selectedCountryEntry
                  ? isRTL
                    ? selectedCountryEntry.ar
                    : selectedCountryEntry.en
                  : t('fields.country.placeholder')}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {countryOpen && (
            <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="w-full ps-8 pe-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    placeholder={isRTL ? 'بحث...' : 'Search...'}
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${
                      country === c.code
                        ? 'bg-accent text-accent-foreground'
                        : ''
                    }`}
                    onClick={() => handleCountrySelect(c.code)}
                  >
                    {isRTL ? c.ar : c.en}
                  </button>
                ))}
                <button
                  type="button"
                  className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground ${
                    isOtherCountry ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={handleOtherCountrySelect}
                >
                  {isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en}
                </button>
              </div>
            </div>
          )}
        </div>
        {isOtherCountry && (
          <Input
            type="text"
            value={customCountry}
            onChange={(e) => onCustomCountryChange?.(e.target.value)}
            placeholder={t('fields.country.placeholder')}
            className={`text-sm mt-2 ${countryError ? 'border-destructive' : ''}`}
            disabled={disabled}
          />
        )}
      </FormField>

      {/* City */}
      <FormField
        label={t('fields.city.label')}
        required={required}
        error={cityError}
      >
        {hasCities ? (
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setCityOpen(!cityOpen);
                setCountryOpen(false);
              }}
              className={`flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                cityError ? 'border-destructive' : 'border-input'
              }`}
            >
              <span
                className={`flex-1 text-start truncate ${
                  city && !isOtherCity
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {city && !isOtherCity
                  ? getCityDisplayLabel(country, city, isRTL) || city
                  : t('fields.city.placeholder')}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {cityOpen && (
              <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <input
                      className="w-full px-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                      placeholder={isRTL ? 'بحث...' : 'Search...'}
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredCities.map((c) => (
                    <button
                      key={c.en}
                      type="button"
                      className={`w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors ${
                        city === c.en || city === c.ar ? 'bg-accent text-accent-foreground' : ''
                      }`}
                      onClick={() =>
                        handleCitySelect(isRTL ? c.ar : c.en)
                      }
                    >
                      {isRTL ? c.ar : c.en}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors text-muted-foreground"
                    onClick={handleOtherCitySelect}
                  >
                    {isRTL ? OTHER_OPTION.ar : OTHER_OPTION.en}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Input
            value={isOtherCountry ? customCity : city}
            onChange={(e) => {
              if (isOtherCountry) {
                onCustomCityChange?.(e.target.value);
              } else {
                onCityChange(e.target.value);
              }
            }}
            placeholder={t('fields.city.placeholder')}
            className={cityError ? 'border-destructive' : ''}
            disabled={disabled}
          />
        )}
        {!isOtherCountry && isOtherCity && (
          <Input
            type="text"
            value={customCity}
            onChange={(e) => onCustomCityChange?.(e.target.value)}
            placeholder={t('fields.city.placeholder')}
            className={`text-sm mt-2 ${cityError ? 'border-destructive' : ''}`}
            disabled={disabled}
          />
        )}
      </FormField>
    </div>
  );
}
