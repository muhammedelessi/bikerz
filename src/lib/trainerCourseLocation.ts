import { COUNTRIES } from '@/data/countryCityData';

/** `tc.location` e.g. "Morocco - Gaza" or "SA - Riyadh" → translated city + country */
export function translateTrainerCourseLocation(raw: string | null | undefined, isRTL: boolean): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const parts = s.split(/\s*-\s*/).map((p) => p.trim());
  const countryPart = parts[0] || '';
  const cityPart = parts[1] || '';
  const countryEntry = COUNTRIES.find((c) => c.en === countryPart || c.code === countryPart || c.ar === countryPart);
  const cityEntry = countryEntry?.cities.find((c) => c.en === cityPart || c.ar === cityPart);
  const displayCity = cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : cityPart;
  const displayCountry = countryEntry ? (isRTL ? countryEntry.ar : countryEntry.en) : countryPart;
  return [displayCity, displayCountry].filter(Boolean).join(' - ');
}

/** Trainer profile `country` + `city` (codes or names) → translated display line */
export function translateTrainerHomeLocation(country: string, city: string, isRTL: boolean): string {
  const cTrim = (country ?? '').trim();
  const cityTrim = (city ?? '').trim();
  const countryEntry = COUNTRIES.find((c) => c.code === cTrim || c.en === cTrim || c.ar === cTrim);
  const cityEntry = countryEntry?.cities.find((x) => x.en === cityTrim || x.ar === cityTrim);
  const displayCity = cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : cityTrim;
  const displayCountry = countryEntry ? (isRTL ? countryEntry.ar : countryEntry.en) : cTrim;
  return [displayCity, displayCountry].filter(Boolean).join(' - ');
}
